const mongoose = require('mongoose');

// One inventory item: a pizza base, sauce, cheese or vegetable.
const itemSchema = new mongoose.Schema({
  type: { type: String, enum: ['base', 'sauce', 'cheese', 'veggie'] },
  name: String,
  price: Number,
  stock: { type: Number, default: 100 }, // units left
  threshold: { type: Number, default: 20 }, // send an alert email when stock goes below this
  alerted: { type: Boolean, default: false }, // so we do not send the same alert again and again
});

module.exports = mongoose.model('Item', itemSchema);
