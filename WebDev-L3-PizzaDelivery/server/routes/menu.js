// Menu (pizzas + ingredients) and the admin inventory screen.
const express = require('express');
const Item = require('../models/Item');
const Pizza = require('../models/Pizza');
const auth = require('../middleware/auth');
const { wrap, fail } = require('../utils/helpers');

const router = express.Router();

// Public: everything the menu and the pizza builder need.
router.get(
  '/menu',
  wrap(async (req, res) => {
    const pizzas = await Pizza.find();
    const items = await Item.find().sort('type price');
    res.json({ pizzas, items });
  })
);

// Admin: see current stock of every item.
router.get(
  '/admin/inventory',
  auth('admin'),
  wrap(async (req, res) => {
    res.json(await Item.find().sort('type name'));
  })
);

// Admin: manually change the stock or the alert threshold of one item.
router.put(
  '/admin/inventory/:id',
  auth('admin'),
  wrap(async (req, res) => {
    const item = await Item.findById(req.params.id);
    if (!item) fail('Item not found', 404);

    if (req.body.stock !== undefined) item.stock = Math.max(0, Number(req.body.stock));
    if (req.body.threshold !== undefined) item.threshold = Math.max(0, Number(req.body.threshold));

    // If stock is back above the limit, allow a new alert email in the future.
    if (item.stock >= item.threshold) item.alerted = false;

    await item.save();
    res.json(item);
  })
);

module.exports = router;
