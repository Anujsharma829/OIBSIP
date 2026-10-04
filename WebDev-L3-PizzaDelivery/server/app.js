// Builds the Express app: middleware + all routes. (server.js starts it.)
const express = require('express');
const cors = require('cors');
const { CLIENT_URL } = require('./config');

const app = express();

app.use(cors({ origin: CLIENT_URL })); // allow the React app to call this API
app.use(express.json()); // read JSON sent in request bodies

// All routes start with /api
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/menu'));
app.use('/api', require('./routes/orders'));

module.exports = app;
