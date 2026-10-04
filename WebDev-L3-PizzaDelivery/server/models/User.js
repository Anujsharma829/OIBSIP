const mongoose = require('mongoose');

// One document per person. role is either 'user' or 'admin'.
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  password: String, // stored as a bcrypt hash, never as plain text
  role: { type: String, default: 'user' },
  verified: { type: Boolean, default: false }, // becomes true after clicking the email link
  token: String, // used for email verification and password reset links
  tokenExp: Date, // when that link stops working
});

module.exports = mongoose.model('User', userSchema);
