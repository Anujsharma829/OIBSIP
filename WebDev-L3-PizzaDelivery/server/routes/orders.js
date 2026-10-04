// Placing orders, Razorpay payment, order history, and the admin order panel.
const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');

const Item = require('../models/Item');
const Pizza = require('../models/Pizza');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const { STATUS } = require('../constants');
const { getIO } = require('../socket');
const { checkLowStock } = require('../jobs/lowStock');
const { wrap, fail } = require('../utils/helpers');

const router = express.Router();

const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID || 'rzp_test_missing',
  key_secret: RAZORPAY_KEY_SECRET || 'missing',
});

// List of inventory item names a pizza recipe uses.
const recipeNames = (recipe) => [recipe.base, recipe.sauce, recipe.cheese, ...(recipe.veggies || [])];

// Turns the cart sent by the browser into trusted order lines.
// We NEVER trust prices from the browser: they are calculated here again from the database.
async function buildLines(cart) {
  if (!Array.isArray(cart) || cart.length === 0) fail('Your cart is empty');

  const pizzas = await Pizza.find();
  const items = await Item.find();
  const itemByName = Object.fromEntries(items.map((i) => [i.name, i]));
  const lines = [];

  for (const cartItem of cart) {
    const qty = Math.max(1, Math.min(10, Number(cartItem.qty) || 1)); // 1 to 10 pizzas

    if (cartItem.kind === 'menu') {
      // A ready-made pizza from the menu.
      const pizza = pizzas.find((p) => String(p._id) === cartItem.pizzaId);
      if (!pizza) fail('Pizza not found');
      lines.push({ name: pizza.name, qty, price: pizza.price, recipe: pizza.recipe });
    } else {
      // A custom pizza: price = Rs 49 (baking + packing) + price of every chosen ingredient.
      const recipe = cartItem.recipe || {};
      const names = recipeNames(recipe);
      const invalid = !recipe.base || !recipe.sauce || !recipe.cheese || names.some((n) => !itemByName[n]);
      if (invalid) fail('Invalid custom pizza');

      const price = 49 + names.reduce((sum, n) => sum + itemByName[n].price, 0);
      lines.push({ name: 'Custom pizza', qty, price, recipe });
    }
  }

  // Check we have enough stock of every ingredient for the whole order.
  const needed = {};
  lines.forEach((line) => {
    recipeNames(line.recipe).forEach((n) => {
      needed[n] = (needed[n] || 0) + line.qty;
    });
  });
  for (const name in needed) {
    if (!itemByName[name] || itemByName[name].stock < needed[name]) {
      fail(`Sorry, ${name} is out of stock`);
    }
  }

  return lines;
}

// ---------- Step 1: create the order and a Razorpay payment order ----------
router.post(
  '/orders',
  auth('user'),
  wrap(async (req, res) => {
    const lines = await buildLines(req.body.items);
    const total = lines.reduce((sum, l) => sum + l.price * l.qty, 0);

    // Razorpay wants the amount in paise (1 rupee = 100 paise).
    const razorpayOrder = await razorpay.orders.create({
      amount: total * 100,
      currency: 'INR',
      receipt: 'rcpt_' + Date.now(),
    });

    const order = await Order.create({
      user: req.user.id,
      lines,
      total,
      address: req.body.address,
      razorpayOrderId: razorpayOrder.id,
    });

    // The browser uses this to open the Razorpay popup.
    res.json({
      orderId: order._id,
      razorpayOrderId: razorpayOrder.id,
      amount: total * 100,
      key: RAZORPAY_KEY_ID,
    });
  })
);

// ---------- Step 2: after payment, verify it really came from Razorpay ----------
router.post(
  '/orders/verify',
  auth('user'),
  wrap(async (req, res) => {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Razorpay signs "orderId|paymentId" with our secret key. We make the same signature and compare.
    const expected = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET || '')
      .update(razorpay_order_id + '|' + razorpay_payment_id)
      .digest('hex');
    if (expected !== razorpay_signature) fail('Payment verification failed');

    const order = await Order.findOne({
      _id: orderId,
      user: req.user.id,
      razorpayOrderId: razorpay_order_id,
    });
    if (!order) fail('Order not found', 404);

    // "if (!order.paid)" makes sure stock is reduced only once, even if this route is called twice.
    if (!order.paid) {
      order.paid = true;
      order.paymentId = razorpay_payment_id;
      await order.save();

      // Reduce stock of every ingredient used.
      const used = {};
      order.lines.forEach((line) => {
        recipeNames(line.recipe).forEach((n) => {
          used[n] = (used[n] || 0) + line.qty;
        });
      });
      for (const name in used) {
        await Item.updateOne({ name }, { $inc: { stock: -used[name] } });
      }

      checkLowStock(); // email the admin right away if something went below its limit
      getIO()?.to('admin').emit('order:new', order); // tell the admin panel live
    }

    res.json(order);
  })
);

// ---------- Customer: my paid orders ----------
router.get(
  '/orders/mine',
  auth('user'),
  wrap(async (req, res) => {
    res.json(await Order.find({ user: req.user.id, paid: true }).sort('-createdAt'));
  })
);

// ---------- Admin: all paid orders ----------
router.get(
  '/admin/orders',
  auth('admin'),
  wrap(async (req, res) => {
    res.json(await Order.find({ paid: true }).populate('user', 'name email').sort('-createdAt'));
  })
);

// ---------- Admin: change an order's status ----------
router.put(
  '/admin/orders/:id/status',
  auth('admin'),
  wrap(async (req, res) => {
    if (!STATUS.includes(req.body.status)) fail('Invalid status');

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    ).populate('user', 'name email');

    // Push the new status straight to that customer's dashboard (no refresh needed).
    getIO()?.to(String(order.user._id)).emit('order:update', order);

    res.json(order);
  })
);

module.exports = router;
