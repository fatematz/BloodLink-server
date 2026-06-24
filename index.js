const express = require("express");
const cors = require("cors");
const app = express();
const port = 5000;
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const { ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});



const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Forbidden: Invalid token" });
  }
};


const verifyAdmin = (req, res, next) => {

  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};




async function run() {
  try {
    await client.connect();

    const database = client.db("assignment_10");
    const usersCollection = database.collection("user");
    const donationRequestsCollection = database.collection("donation_requests");
    const fundsCollection = database.collection("funds");


    app.post("/api/auth/jwt", async (req, res) => {
      try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email required" });

        const user = await usersCollection.findOne({ email });
        const role = user?.role || "donor";

        const token = jwt.sign({ email, role }, process.env.JWT_SECRET, {
          expiresIn: "7d",
        });
        res.json({ token });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    app.get("/api/donation-requests",  verifyToken, async (req, res) => {
      try {
        const query = {};
        if (req.query.requesterEmail)
          query.requesterEmail = req.query.requesterEmail;
        if (req.query.status) query.donationStatus = req.query.status;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;

        const requests = await donationRequestsCollection
          .find(query)
          .sort({ _id: -1 })
          .skip(skip)
          .limit(limit)
          .toArray();
        const totalRequests =
          await donationRequestsCollection.countDocuments(query);

        res.send({
          requests,
          totalPages: Math.ceil(totalRequests / limit),
          currentPage: page,
          totalRequests,
        });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });



    app.get("/api/donation-requests/:id", verifyToken, async (req, res) => {
      try {
        const result = await donationRequestsCollection.findOne({
          _id: new ObjectId(req.params.id),
        });
        if (!result) return res.status(404).json({ message: "Not found" });
        res.send(result);
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    app.get("/api/funds", async (req, res) => {
      try {
        const funds = await fundsCollection.find().sort({ _id: -1 }).toArray();
        const total = funds.reduce((sum, f) => sum + (f.amount || 0), 0);
        res.send({ funds, total });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    app.get("/api/users/email/:email", async (req, res) => {
      try {
        const user = await usersCollection.findOne({ email: req.params.email });
        if (!user) return res.status(404).json({ message: "User not found" });
        const { passwordHash, ...safeUser } = user;
        res.send(safeUser);
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });




    app.post("/api/donation-requests", verifyToken, async (req, res) => {
      try {
        const job = req.body;
        if (!job.recipientName || !job.bloodGroup) {
          return res.status(400).json({ message: "Missing required fields" });
        }
        const newRequest = {
          ...job,
          donationStatus: "pending",
          createdAt: new Date(),
        };
        const result = await donationRequestsCollection.insertOne(newRequest);
        res.status(201).send({ success: true, insertedId: result.insertedId });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });

    app.patch(
      "/api/donation-requests/edit/:id",
      verifyToken,
      async (req, res) => {
        try {
          const id = req.params.id;
          if (!ObjectId.isValid(id))
            return res.status(400).json({ message: "Invalid ID format" });
          const filter = { _id: new ObjectId(id) };
          const result = await donationRequestsCollection.updateOne(filter, {
            $set: { ...req.body },
          });
          if (result.matchedCount === 0)
            return res.status(404).json({ message: "Request not found" });
          res.send({ success: true, result });
        } catch (err) {
          res
            .status(500)
            .json({ message: "Internal Server Error", error: err.message });
        }
      },
    );


    app.patch("/api/donation-requests/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id))
          return res.status(400).json({ message: "Invalid ID format" });
        const { donationStatus } = req.body;
        const result = await donationRequestsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { donationStatus } },
        );
        if (result.matchedCount === 0)
          return res.status(404).json({ message: "Request not found" });
        res.send({ success: true, result });
      } catch (err) {
        res
          .status(500)
          .json({ message: "Internal Server Error", error: err.message });
      }
    });

    app.delete("/api/donation-requests/:id", verifyToken, async (req, res) => {
      try {
        const result = await donationRequestsCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Internal Server Error" });
      }
    });



    app.post("/api/funds", verifyToken, async (req, res) => {
      try {
        const { name, email, amount, transactionId } = req.body;
        const fund = {
          name,
          email,
          amount: parseFloat(amount),
          transactionId,
          date: new Date(),
          status: "success",
        };
        const result = await fundsCollection.insertOne(fund);
        res.status(201).send({ success: true, insertedId: result.insertedId });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });




    app.patch(
      "/api/users/update-profile/:id",
      verifyToken,
      async (req, res) => {
        try {
          const { id } = req.params;
          const { bloodGroup, district, upazila } = req.body;
          const user = await usersCollection.findOne({ _id: new ObjectId(id) });
          if (!user) return res.status(404).json({ message: "User not found" });
          if (user.status === "blocked")
            return res.status(403).json({ message: "You are blocked." });
          const result = await usersCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { bloodGroup, district, upazila } },
          );
          res.send(result);
        } catch (err) {
          res.status(500).json({ message: err.message });
        }
      },
    );



    app.get("/api/users" , verifyToken, async (req, res) => {
      try {
        const query = {};
        if (req.query.status) query.status = req.query.status;
        if (req.query.role) query.role = req.query.role;
        if (req.query.bloodGroup) query.bloodGroup = req.query.bloodGroup;
        if (req.query.district) query.district = req.query.district;
        if (req.query.upazila) query.upazila = req.query.upazila;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const total = await usersCollection.countDocuments(query);
        const users = await usersCollection
          .find(query)
          .skip(skip)
          .limit(limit)
          .toArray();
        const safe = users.map(({ passwordHash, ...rest }) => rest);

        res.send({
          users: safe,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          total,
        });
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });


    app.patch(
      "/api/users/update/:id",
      verifyToken,
      verifyAdmin,
      // verifyRole,
      async (req, res) => {
        const id = req.params.id;
        const { status, role } = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { ...(status && { status }), ...(role && { role }) },
        };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.send(result);
      },
    );


    console.log("Connected to MongoDB!");
  } catch (err) {
    console.error(err);
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
