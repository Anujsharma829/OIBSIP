// Starting point of the backend. Run it with: npm start
require('dotenv').config(); // load the .env file FIRST, before anything else reads it

const http = require('http');
const mongoose = require('mongoose');

const app = require('./app');
const seed = require('./seed');
const { initSocket } = require('./socket');
const { startLowStockJob } = require('./jobs/lowStock');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/pizzaapp';

async function start() {
  await mongoose.connect(MONGO_URI); // 1. connect to MongoDB
  await seed(); // 2. add ingredients, pizzas and admin if missing

  const server = http.createServer(app);
  initSocket(server); // 3. real-time updates
  startLowStockJob(); // 4. scheduled low stock emails

  server.listen(PORT, () => console.log('API running on port', PORT)); // 5. start listening
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
