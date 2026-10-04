const mongoose = require('mongoose');

// Ready-made pizzas shown on the menu. "recipe" lists which inventory items it uses.
const pizzaSchema = new mongoose.Schema({
  name: String,
  desc: String,
  price: Number,
  recipe: {
    base: String,
    sauce: String,
    cheese: String,
    veggies: [String],
  },
});

module.exports = mongoose.model('Pizza', pizzaSchema);
