import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
import jwt from 'jsonwebtoken';

// Vars
const app = express();
const port = process.env.PORT;
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.5yy5x.mongodb.net/?retryWrites=true&w=majority`;

// Middleware
app.use(express.json());
app.use(cors());

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

    console.log('DB CONNECTED!');

    // Routes

    // Generates JWT
    app.put('/api/user', async (req, res) => {
      const { uid, isVerified } = req.body;

      if (!uid || typeof isVerified !== 'boolean') {
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
              isVerified: isVerified,
            },
          },
          { upsert: true, returnDocument: 'before' }
        );

        const accessToken = jwt.sign(
          { uid, role: result?.value?.role || 'user', isVerified: isVerified },
          process.env.JWT_SECRET,
          {
            expiresIn: '1d',
          }
        );

        return res.status(200).send(accessToken);
      } catch (err) {
        res.status(500).send(err?.message || 'Could not generate JWT');
      }
    });
  } finally {
  }
};

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('IT WORKS!');
});

app.listen(port, () => {
  console.log(`Server is running on: http://localhost:${port}`);
});
