import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Vars
const port = process.env.PORT;
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.send('OK');
});

app.listen(port, () => {
  console.log(`Server is running on: http://localhost:${port}`);
});
