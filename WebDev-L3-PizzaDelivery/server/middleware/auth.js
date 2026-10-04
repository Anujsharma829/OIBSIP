// Checks the JWT token sent by the browser in the "Authorization" header.
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

// auth()        -> any logged in person can pass
// auth('admin') -> only admins can pass
// auth('user')  -> only normal customers can pass
const auth = (role) => (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET); // throws if token is fake or expired

    if (role && payload.role !== role) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    req.user = payload; // { id, role } is now available inside the route
    next();
  } catch {
    res.status(401).json({ message: 'Please log in again' });
  }
};

module.exports = auth;
