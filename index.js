const express = require("express");
const cors = require("cors");
const app = express();
const port = 5000;
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
const { ObjectId } = require("mongodb");

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

async function run() {
  try {
    await client.connect();

    const database = client.db("assignment_10");

    const usersCollection = database.collection("user");
    const donationRequestsCollection = database.collection("donation_requests");






app.post("/api/donation-requests", async (req, res) => {
  try {
    const job = req.body; 

    if (!job.recipientName || !job.bloodGroup) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // এখানে donationStatus: "pending" যোগ করে দেওয়া হয়েছে
    const newRequest = {
      ...job,
      donationStatus: "pending", 
      createdAt: new Date()
    };

    const result = await donationRequestsCollection.insertOne(newRequest);
    res.status(201).send({ success: true, insertedId: result.insertedId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


app.get("/api/donation-requests", async (req, res) => {
  try {
    const query = {};
    
    if (req.query.requesterEmail) {
      query.requesterEmail = req.query.requesterEmail;
    }

    if (req.query.status) {
      query.donationStatus = req.query.status;
    }

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
      totalRequests
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

    
    app.get("/api/users", async (req, res) => {
      try {
        const query = {};
        if (req.query.status) query.status = req.query.status;
        if (req.query.role) query.role = req.query.role;

        const users = await usersCollection.find(query).toArray();

        const safe = users.map(({ passwordHash, ...rest }) => rest);

        res.send(safe);
      } catch (err) {
        res.status(500).json({ message: err.message });
      }
    });


app.get("/api/donation-requests/:id", async (req, res) => {
  const { ObjectId } = require("mongodb");
  try {
    const result = await donationRequestsCollection.findOne({ _id: new ObjectId(req.params.id) });
    if (!result) return res.status(404).json({ message: "Not found" });
    res.send(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


app.delete('/api/donation-requests/:id', async (req, res) => {
    const { ObjectId } = require("mongodb");
    const id = req.params.id;
    try {
        const query = { _id: new ObjectId(id) };
        const result = await donationRequestsCollection.deleteOne(query);
        res.send(result);
    } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).send({ message: "Internal Server Error" });
    }
});



app.patch("/api/donation-requests/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const filter = { _id: new ObjectId(id) }; 
    
    
    const updateDoc = { 
      $set: {
        donationStatus: req.body.donationStatus,
        donorName: req.body.donorName,
        donorEmail: req.body.donorEmail
      } 
    };
    
    const result = await donationRequestsCollection.updateOne(filter, updateDoc);
    
    if (result.matchedCount === 0) {
        return res.status(404).json({ message: "Request not found" });
    }
    
    res.send({ success: true, result });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});



app.patch("/api/users/update/:id", async (req, res) => {
  const id = req.params.id;
  const { status, role } = req.body;
  const filter = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      ...(status && { status }), 
      ...(role && { role })      
    },
  };
  const result = await usersCollection.updateOne(filter, updateDoc);
  res.send(result);
});




    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } catch (err) {
    console.error(err);
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
