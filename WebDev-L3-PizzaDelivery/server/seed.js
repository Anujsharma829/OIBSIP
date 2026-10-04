// Fills an empty database with ingredients, pizzas and the admin account (runs on every start, only adds what is missing).
const bcrypt = require('bcryptjs');
const Item = require('./models/Item');
const Pizza = require('./models/Pizza');
const User = require('./models/User');

async function seed() {
  // ----- ingredients -----
  if ((await Item.countDocuments()) === 0) {
    // helper: [['Name', price], ...] -> [{ type, name, price }, ...]
    const make = (type, list) => list.map(([name, price]) => ({ type, name, price }));

    await Item.insertMany([
      ...make('base', [['Classic Hand-Tossed', 149], ['Thin Crust', 159], ['Cheese Burst', 199], ['Whole Wheat', 169], ['Multigrain', 179]]),
      ...make('sauce', [['Tomato Basil', 20], ['Pesto', 35], ['BBQ', 30], ['Alfredo', 35], ['Spicy Arrabbiata', 25]]),
      ...make('cheese', [['Mozzarella', 40], ['Cheddar', 40], ['Parmesan', 55], ['Vegan Cashew', 70]]),
      ...make('veggie', [['Onion', 15], ['Capsicum', 20], ['Tomato', 15], ['Mushroom', 30], ['Olives', 25], ['Sweet Corn', 20], ['Jalapeño', 20], ['Paneer', 45]]),
    ]);

    // ----- ready-made pizzas -----
    const recipe = (base, sauce, cheese, veggies) => ({ base, sauce, cheese, veggies });

    await Pizza.insertMany([
      { name: 'Margherita', desc: 'Basil tomato sauce, fresh mozzarella, nothing else needed.', price: 249, recipe: recipe('Classic Hand-Tossed', 'Tomato Basil', 'Mozzarella', ['Tomato']) },
      { name: 'Farmhouse', desc: 'Onion, capsicum, mushroom and tomato on a golden crust.', price: 329, recipe: recipe('Classic Hand-Tossed', 'Tomato Basil', 'Mozzarella', ['Onion', 'Capsicum', 'Mushroom', 'Tomato']) },
      { name: 'Paneer Tikka', desc: 'Smoky BBQ base with paneer, onion and capsicum.', price: 349, recipe: recipe('Thin Crust', 'BBQ', 'Cheddar', ['Paneer', 'Onion', 'Capsicum']) },
      { name: 'Green Pesto', desc: 'Pesto, parmesan, olives, mushroom and sweet corn.', price: 359, recipe: recipe('Whole Wheat', 'Pesto', 'Parmesan', ['Olives', 'Mushroom', 'Sweet Corn']) },
      { name: 'Mexican Fire', desc: 'Arrabbiata, jalapeño, corn and onion. Brings the heat.', price: 339, recipe: recipe('Multigrain', 'Spicy Arrabbiata', 'Cheddar', ['Jalapeño', 'Sweet Corn', 'Onion']) },
      { name: 'Cheese Burst Supreme', desc: 'Cheese-stuffed crust with a triple veggie topping.', price: 399, recipe: recipe('Cheese Burst', 'Alfredo', 'Mozzarella', ['Mushroom', 'Olives', 'Capsicum']) },
    ]);
  }

  // ----- admin account (email and password come from .env) -----
  if (!(await User.findOne({ role: 'admin' }))) {
    await User.create({
      name: 'Admin',
      email: process.env.ADMIN_EMAIL || 'admin@pizza.com',
      password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 10),
      role: 'admin',
      verified: true,
    });
  }
}

module.exports = seed;
