const mongoose = require('mongoose');
const { STATUS } = require('../constants');

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lines: [{ name: String, qty: Number, price: Number, recipe: Object }], // pizzas in this order
    total: Number, // in rupees
    address: String,
    status: { type: String, enum: STATUS, default: STATUS[0] },
    paid: { type: Boolean, default: false }, // true only after Razorpay payment is verified
    razorpayOrderId: String,
    paymentId: String,
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

module.exports = mongoose.model('Order', orderSchema);
