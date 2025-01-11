const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin:[
    'http://localhost:5173',
    'http://localhost:5174',
    'https://assignment-eleven-3bd98.web.app',
    'https://assignment-eleven-3bd98.firebaseapp.com'
  ],
  credentials: true
}))
app.use(express.json());
app.use(cookieParser())

// token verify section: 
const verifyToken = (req,res,next) =>{
  const token = req.cookies?.token;
  // console.log('token verify', token)
  if(!token){
    return res.status(401).send({ message: 'unauthorized access'});
  }
// verify token
jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
  if(err){
    return res.status(401).send({message: 'unauthorized access'});
  }
  req.user = decoded;
  next()
})

  
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.emc8p.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;


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
    // await client.connect();

    const tutorsCollection = client.db('tutorBooking').collection('tutors')
    const categoryCollection = client.db('tutorBooking').collection('categories')
    const bookingCollection = client.db('tutorBooking').collection('bookings')
    // tutors related apis
    app.get('/tutors',verifyToken,async(req,res)=>{
      const cursor =  tutorsCollection.find();
       const result = await cursor.toArray();
      res.send(result)
    })


     // tutors related apis findTutors
     app.get('/allTutors',async(req,res)=>{
      const cursor =  tutorsCollection.find();
       const result = await cursor.toArray();
      res.send(result)
    })
// Auth related APIS

  app.post('/jwt', (req,res)=>{
    const user = req.body;
    const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn:'120h'});

      res
       .cookie('token', token, {
        httpOnly:true,
        secure: process.env.NODE_ENV=== 'production',
        sameSite: process.env.NODE_ENV=== "production" ? "none" : "strict",
       })
       .send({ success: true })
    
  })

  // Logout clears the cookie token

  app.post('/logout', (req,res)=>{
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV=== 'production',
      sameSide: process.env.NODE_ENV=== "production" ? "none" : "strict",
    })
    .send({ success: true })
  })




     // Search related apis
    app.get('/searchTutors',async(req,res)=>{
      const {searchParams} = req.query;
      // console.log(searchParams);
      let option = {};
      if(searchParams){
        option = { 
          language:{ $regex:searchParams, $options:"i" } };
      }
       const result = await tutorsCollection.find(option).toArray();
      res.send(result);
    })
    //API for fetching all categories
    app.get('/categories',async(req,res)=>{
      const categories = await categoryCollection.find().toArray()
      res.send(categories)
    })
    // fetching specific categories
     app.get('/category/:language',async(req,res)=>{
       const language = req.params.language
       const categories = await tutorsCollection.find({language:language}).limit(9).toArray()
        console.log(categories)
       res.send(categories)
     })

  //  Id related get apis
  app.get('/tutors/:id',verifyToken,async(req,res)=>{
    const id = req.params.id;
    const tutor = await tutorsCollection.findOne({_id:new ObjectId(id)});
    if (tutor){
      res.send(tutor);
    }
    else{
      res.status(404).send({message:"Tutor not found"})
    }
  })
  // Fetch all booking
  app.get('/booking',verifyToken, async(req,res)=>{
    // console.log(req.cookies)
    const booking = await bookingCollection.find().toArray()
    res.send(booking);
  })
    // Matching Email
    app.get('/myEmail',verifyToken,async(req,res)=>{
      const email = req.query.email;

       console.log('cookis cookis',req.cookies?.token)
//  token email !== query email
if(req.user.email !== req.query.email){
  return res.status(403).send({message: 'forbidden access'})
}

      const result = await tutorsCollection.find({email:email}).toArray() ;
      res.send(result)
    })

    // count language review tutors
     app.get('/stats', async(req,res)=>{
       const tutorsCount = await tutorsCollection.countDocuments()
        const reviewsCount = await tutorsCollection.aggregate([
          { $group: { _id: null, totalReviews: { $sum: "$reviews" } } },
        ]).toArray();
          const languagesCount = await tutorsCollection.aggregate([
            { $group: { _id: "$language" } },
            { $count: "totalLanguages" }
          ]).toArray();
      
          const totalLanguages = languagesCount[0]?.totalLanguages || 0;
      
      
          //  console.log('Languages Count:', totalLanguages)
       const usersCount = await bookingCollection.countDocuments();
       res.send({
          tutors: tutorsCount,
          reviews: reviewsCount[0]?.totalReviews || 0,
            languages: totalLanguages,
         users: usersCount,
       })
     })


// Update tutor data
app.patch('/tutors/:id',async(req,res)=>{
  const id = req.params.id;
  const updatedFields = req.body;
  const result = await tutorsCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updatedFields }
  );
  res.send(result);
})


    // new tutors add
      app.post('/tutors', async (req, res) => {
         try {
         const newTutor = req.body;
          console.log(newTutor);
           const result = await tutorsCollection.insertOne(newTutor);
           res.status(201).send(result);
           } 
           catch (error) {
            console.error("Error inserting tutor:", error);
            res.status(500).send({ error: "Failed to add tutor" });
  }
});

// POST API to handle bookings
app.post('/book',async(req,res)=>{
  const booking = req.body;
  const result = await bookingCollection.insertOne(booking);
  res.send(result)
})

// Delete data fetching
app.delete('/delete/:id', async(req,res)=>{
  const id =req.params.id;
  const query = { _id:new ObjectId(id) }
  const result = await tutorsCollection.deleteOne(query);
  res.send(result)
})


// Update review count for a specific tutor
app.patch('/review/:tutorId', async(req,res)=>{
  const tutorId = req.params.tutorId;
  const result = await tutorsCollection.updateOne(
    { _id: new ObjectId(tutorId) },
    { $inc: { reviews: 1 } }
  )
  if(result.matchedCount === 0){
    return res.status(404).send({message:'Tutor not found'});
  }
  res.send(result);
})

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/',(req,res)=>{
 res.send('Online tutor booking platform started')
})
app.listen(port,()=>{
    console.log(`Online tutor booked:${port}`)
})