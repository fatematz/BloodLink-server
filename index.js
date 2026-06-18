const express = require('express')
const cors = require('cors')
const app = express()
const port = 5000
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');


app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello World!')
})


const uri =process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)

    
const database = client.db("assignment_10"); 
    const usersCollection = database.collection("users");



app.post('/users', async (req, res) => {
      try {
        const body = req.body;

        const exists = await usersCollection.findOne({ email: body.email });
        if (exists) {
          return res.status(409).json({ message: "Email already registered" });
        }

        const { confirmPassword, ...userDoc } = body;
        const result = await usersCollection.insertOne({ ...userDoc, createdAt: new Date() });

        res.status(201).json({ insertedId: result.insertedId });
      } catch (err) {
        console.error("Express API Error:", err);
        res.status(500).json({ message: err.message });
      }
    });


    app.post('/login', async (req, res) => {
      try {
        const { email, password } = req.body;

        const user = await usersCollection.findOne({ email: email });
        
        if (!user) {
          return res.status(401).json({ message: "Invalid email or password" });
        }

        if (user.password !== password) {
          return res.status(401).json({ message: "Invalid email or password" });
        }

        const { password: _, confirmPassword: __, ...userData } = user;
        res.status(200).json({ message: "Login successful", user: userData });

      } catch (err) {
        console.error("Express Login Error:", err);
        res.status(500).json({ message: err.message });
      }
    });
    




    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);








app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})