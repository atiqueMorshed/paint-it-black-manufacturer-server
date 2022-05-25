import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import Stripe from 'stripe';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
import jwt from 'jsonwebtoken';

// Vars
const stripe = new Stripe(`${process.env.STRIPE_SECRET_KEY}`);
const app = express();
const port = process.env.PORT;
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.5yy5x.mongodb.net/?retryWrites=true&w=majority`;

// Middleware
app.use(express.json());
app.use(cors());

const validateJWT = (req, res, next) => {
  try {
    if (!req?.headers?.authorization) {
      return res.status(401).send('Unauthorized Access (JWT not found).');
    }
    const token = req.headers.authorization.split(' ')[1];

    if (!token) {
      return res.status(401).send('Unauthorized Access (NO JWT found).');
    }

    jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
      if (error) {
        return res.status(403).send('Forbidden Access! (Invalid JWT)');
      }
      if (decoded) {
        req.decoded = decoded;
        next();
      }
    });
  } catch (error) {
    return res.status(401).send('Unauthorized Access.');
  }
};

// Check if incoming JSON is valid.
app.use((err, req, res, next) => {
  if (err.status === 400) {
    return res.status(err.status).send('Invalid JSON Object');
  }
  return next(err);
});

// MongoDB Client
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    await client.connect();

    // Collections
    const userCollection = client
      .db('paint-it-black-manufacturer')
      .collection('user');

    const toolCollection = client
      .db('paint-it-black-manufacturer')
      .collection('tool');

    const orderCollection = client
      .db('paint-it-black-manufacturer')
      .collection('order');

    const paymentCollection = client
      .db('paint-it-black-manufacturer')
      .collection('payment');

    const reviewCollection = client
      .db('paint-it-black-manufacturer')
      .collection('review');

    console.log('DB CONNECTED!');

    // Routes

    // Generates JWT
    app.put('/api/user', async (req, res) => {
      const { uid } = req.body;

      if (!uid) {
        return res
          .status(406)
          .send(
            'Could not update users collections. Insufficient information provided.'
          );
      }

      try {
        // Only inserts if no document is found. So, it'd be always new user (not admin) if insertion is successful.
        // filter, update, options
        const result = await userCollection.findOneAndUpdate(
          { uid: uid },
          {
            $setOnInsert: {
              uid,
              role: 'user',
            },
          },
          { upsert: true, returnDocument: 'before' }
        );

        const role = result?.value?.role || 'user';
        const accessToken = jwt.sign({ uid, role }, process.env.JWT_SECRET, {
          expiresIn: '1d',
        });

        return res.status(200).send(accessToken);
      } catch (err) {
        res.status(500).send(err?.message || 'Could not generate JWT');
      }
    });

    // Get User Profile
    app.get('/api/userprofile/:uid', validateJWT, async (req, res) => {
      const { uid } = req.params;
      const decodedUid = req?.decoded?.uid;
      if (!uid || decodedUid !== uid) {
        return res.status(403).send('Forbidden Access! (Not your JWT bro).');
      }

      try {
        const result = await userCollection.findOne({ uid: uid });

        return res.status(200).send(result);
      } catch (err) {
        res.status(500).send(err?.message || 'Could not get profile data.');
      }
    });

    // Get User Type
    app.get('/api/usertype/:uid', validateJWT, async (req, res) => {
      const { uid } = req.params;
      const decodedUid = req?.decoded?.uid;
      if (!uid || decodedUid !== uid) {
        return res.status(403).send('Forbidden Access! (Not your JWT bro).');
      }

      try {
        const type = req.decoded.role;

        return res.status(200).send(type);
      } catch (err) {
        res.status(500).send(err?.message || 'Could not get profile data.');
      }
    });

    // Gets all tools information
    app.get('/api/tool', async (req, res) => {
      try {
        const result = await toolCollection.find({}).toArray();
        return res.status(200).send(result);
      } catch (error) {
        return res.status(500).send('Could not fetch tools data.');
      }
    });

    // Update User Profile
    app.patch('/api/userprofile', validateJWT, async (req, res) => {
      const profileData = req.body;
      const decodedUid = req?.decoded?.uid;
      if (!profileData.uid || decodedUid !== profileData.uid) {
        return res.status(403).send('Forbidden Access! (Not your JWT bro).');
      }
      const { location, education, phone, linkedin, uid } = req.body;

      try {
        const result = await userCollection.updateOne(
          { uid: uid },
          {
            $set: {
              location: location || '',
              education: education || '',
              phone: phone || '',
              linkedin: linkedin || '',
            },
          }
        );

        return res.status(200).send(result);
      } catch (err) {
        res.status(500).send(err?.message || 'Could not get profile data.');
      }
    });

    // Gets all tools information
    app.get('/api/tool', async (req, res) => {
      try {
        const result = await toolCollection.find({}).toArray();
        return res.status(200).send(result);
      } catch (error) {
        return res.status(500).send('Could not fetch tools data.');
      }
    });

    // Gets a specific tools information
    app.get('/api/tool/:id', async (req, res) => {
      const { id } = req.params;
      if (!id || !ObjectId.isValid(id)) {
        return res.status(406).send('Invalid Tool ID.');
      }

      try {
        const result = await toolCollection.findOne({ _id: ObjectId(id) });

        return res.status(200).send(result);
      } catch (error) {
        return res.status(500).send('Could not fetch tools data.');
      }
    });

    // Gets all orders of an user.
    app.get('/api/order/:uid', validateJWT, async (req, res) => {
      const { uid } = req.params;
      const decodedUid = req?.decoded?.uid;
      if (!uid || decodedUid !== uid) {
        return res.status(403).send('Forbidden Access! (Not your JWT bro).');
      }
      try {
        const result = await orderCollection
          .find({ uid: uid })
          .sort({ orderedOn: -1 })
          .toArray();
        return res.status(200).send(result);
      } catch (error) {
        return res.status(500).send('Server Error. Could not get orders.');
      }
    });

    // Delets an order of an user.
    app.delete('/api/order/', validateJWT, async (req, res) => {
      const { uid, orderId } = req.body;
      const decodedUid = req?.decoded?.uid;
      if (!uid || decodedUid !== uid) {
        return res.status(403).send('Forbidden Access! (Not your JWT bro).');
      }
      if (!orderId || !ObjectId.isValid(orderId)) {
        return res.status(406).send('Invalid order ID.');
      }

      const query = {
        _id: ObjectId(orderId),
        paymentStatus: { $exists: false },
      };
      const options = {
        projection: { uid: 1, _id: 0 },
      };
      try {
        const order = await orderCollection.findOne(query, options);

        if (!order?.uid || uid !== order.uid) {
          return res
            .status(401)
            .send('You are not authorized to delete this order.');
        }

        const result = await orderCollection.deleteOne(query);
        if (result.deletedCount === 1)
          return res.status(200).send('Deletion Successful.');
        else return res.status(200).send('Deletion Failed.');
      } catch (error) {
        return res.status(500).send('Server Error. Could not get orders.');
      }
    });

    // Sets order information
    app.post('/api/order', validateJWT, async (req, res) => {
      const orderData = req.body;
      const decodedUid = req?.decoded?.uid;
      if (!orderData?.uid || decodedUid !== orderData.uid) {
        return res.status(403).send('Forbidden Access! (Not your JWT bro).');
      }

      const {
        uid,
        email,
        name,
        address,
        phone,
        toolId,
        toolName,
        quantity,
        total,
      } = orderData;

      if (
        !uid ||
        !email ||
        !name ||
        !address ||
        !phone ||
        !toolId ||
        !toolName ||
        !quantity ||
        !total
      ) {
        return res.status(406).send('Insufficient order information.');
      }

      try {
        const result = await orderCollection.insertOne({
          uid,
          email,
          name,
          address,
          phone,
          toolId,
          toolName,
          quantity,
          total,
          orderedOn: new Date(),
        });

        return res.status(200).send({ _id: result.insertedId, ...orderData });
      } catch (error) {
        return res.status(500).send('Could not post order information.');
      }
    });

    // Updates payment info in DB.
    app.patch('/api/order', validateJWT, async (req, res) => {
      const { uid, transactionId, orderId, total, quantity, toolId } = req.body;
      const decodedUid = req?.decoded?.uid;
      if (!uid || decodedUid !== uid)
        return res.status(403).send('Forbidden Access! (Not your JWT bro).');

      if (!orderId || !ObjectId.isValid(orderId)) {
        return res.status(406).send('Invalid order ID.');
      }

      if (!toolId || !ObjectId.isValid(toolId)) {
        return res.status(406).send('Invalid tool ID.');
      }

      const filter = { _id: ObjectId(orderId) };
      const date = new Date();
      try {
        const updatedDoc = {
          $set: {
            paymentStatus: 'paid',
            transactionId,
            paidOn: date,
          },
        };

        const updateResult = await orderCollection.updateOne(
          filter,
          updatedDoc
        );

        // Decrement tool available quantity
        const updatedToolDoc = {
          $inc: {
            available: parseInt(-1 * quantity),
          },
        };
        const toolAvailabilityUpdate = await toolCollection.updateOne(
          { _id: ObjectId(toolId) },
          updatedToolDoc
        );

        const result = await paymentCollection.insertOne({
          orderId,
          transactionId,
          total,
          date,
        });
        res.status(200).send(updateResult);
      } catch (error) {
        res.status(500).send(error.message);
      }
    });

    // Stripe Payment Intent
    app.post('/api/create-payment-intent', validateJWT, async (req, res) => {
      try {
        const { total, uid } = req.body;

        const decodedUid = req?.decoded?.uid;
        if (!uid || decodedUid !== uid) {
          return res.status(403).send('Forbidden Access! (Not your JWT bro).');
        }

        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
          amount: total * 100,
          currency: 'usd',
          payment_method_types: ['card'],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        res.status(500).send(error.message);
      }
    });

    // Adds review
    app.post('/api/review', validateJWT, async (req, res) => {
      const reviewData = req.body;
      const decodedUid = req?.decoded?.uid;
      if (!reviewData?.uid || decodedUid !== reviewData.uid) {
        return res.status(403).send('Forbidden Access! (Not your JWT bro).');
      }

      const { uid, review, rating, displayName } = reviewData;

      if (!uid || !review || !rating || !displayName) {
        return res.status(406).send('Insufficient review information.');
      }

      try {
        const result = await reviewCollection.insertOne({
          uid,
          review,
          rating,
          displayName,
          reviewedOn: new Date(),
        });

        return res.status(200).send(result);
      } catch (error) {
        return res.status(500).send(error.message);
      }
    });

    // Gets all reviews.
    app.get('/api/review', async (req, res) => {
      try {
        const result = await reviewCollection
          .find({})
          .sort({ reviewedOn: -1 })
          .toArray();
        return res.status(200).send(result);
      } catch (error) {
        return res.status(500).send(error.message);
      }
    });
  } finally {
    // Close connection
  }
};

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('IT WORKS!');
});

app.listen(port, () => {
  console.log(`Server is running on: http://localhost:${port}`);
});
