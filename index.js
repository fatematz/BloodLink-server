const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
app.use(cors());
// app.use(
//   cors({
//     origin: [
//       "https://blood-link-chi-wine.vercel.app",
//     ],
//     credentials: true,
//   })
// );
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let usersCollection, donationRequestsCollection, fundsCollection;

async function connectDB() {
  if (!usersCollection) {
    await client.connect();
    const database = client.db("assignment_10");
    usersCollection = database.collection("user");
    donationRequestsCollection = database.collection("donation_requests");
    fundsCollection = database.collection("funds");
  }
}

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

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post("/api/auth/jwt", async (req, res) => {
  try {
    await connectDB();
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

app.get("/api/donation-requests", async (req, res) => {
  try {
    await connectDB();
    const query = {};
    if (req.query.requesterEmail) query.requesterEmail = req.query.requesterEmail;
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
    const totalRequests = await donationRequestsCollection.countDocuments(query);

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
    await connectDB();
    const result = await donationRequestsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });
    if (!result) return res.status(404).json({ message: "Not found" });
    res.send(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/donation-requests", verifyToken, async (req, res) => {
  try {
    await connectDB();
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

app.patch("/api/donation-requests/edit/:id", verifyToken, async (req, res) => {
  try {
    await connectDB();
    const id = req.params.id;
    if (!ObjectId.isValid(id))
      return res.status(400).json({ message: "Invalid ID format" });
    const result = await donationRequestsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...req.body } },
    );
    if (result.matchedCount === 0)
      return res.status(404).json({ message: "Request not found" });
    res.send({ success: true, result });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});

app.patch("/api/donation-requests/:id", verifyToken, async (req, res) => {
  try {
    await connectDB();
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
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});

app.delete("/api/donation-requests/:id", verifyToken, async (req, res) => {
  try {
    await connectDB();
    const result = await donationRequestsCollection.deleteOne({
      _id: new ObjectId(req.params.id),
    });
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: "Internal Server Error" });
  }
});

app.get("/api/funds", verifyToken,  async (req, res) => {
  try {
    await connectDB();
    const funds = await fundsCollection.find().sort({ _id: -1 }).toArray();
    const total = funds.reduce((sum, f) => sum + (f.amount || 0), 0);
    res.send({ funds, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


app.get("/api/funds/total", async (req, res) => {
  try {
    await connectDB();
    const result = await fundsCollection
      .aggregate([
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ])
      .toArray();
    res.json({ total: result[0]?.total || 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/funds", verifyToken, async (req, res) => {
  try {
    await connectDB();
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

app.get("/api/users/email/:email", async (req, res) => {
  try {
    await connectDB();
    const user = await usersCollection.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ message: "User not found" });
    const { passwordHash, ...safeUser } = user;
    res.send(safeUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    await connectDB();
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
    const users = await usersCollection.find(query).skip(skip).limit(limit).toArray();
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

app.patch("/api/users/update-profile/:id", verifyToken, async (req, res) => {
  try {
    await connectDB();
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
});

app.patch("/api/users/update/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    await connectDB();
    const id = req.params.id;
    const { status, role } = req.body;
    const filter = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: { ...(status && { status }), ...(role && { role }) },
    };
    const result = await usersCollection.updateOne(filter, updateDoc);
    res.send(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

if (require.main === module) {
  app.listen(5000, () => console.log('Server listening on port 5000'));
}

module.exports = app;
