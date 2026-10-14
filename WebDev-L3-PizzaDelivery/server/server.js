import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-this-secret';
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
let useMongo = Boolean(process.env.MONGODB_URI);

app.use(cors({ origin: true })); // allow localhost, 127.0.0.1 and LAN URLs on any port
app.use(express.json({ limit: '1mb' }));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }
}, { timestamps: true });
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName: String, customerEmail: String, items: Array, subtotal: Number, deliveryFee: Number, total: Number,
  paymentMethod: { type: String, default: 'UPI' }, paymentStatus: { type: String, default: 'Demo - not charged' }, deliveryAddress: { phone: String, address: String, city: String, pincode: String },
  status: { type: String, default: 'Order Received' }
}, { timestamps: true });
const inventorySchema = new mongoose.Schema({
  name: { type: String, unique: true }, stock: { type: Number, default: 100 }, unit: { type: String, default: 'units' }
});
const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);
const Inventory = mongoose.model('Inventory', inventorySchema);

let local = { users: [], orders: [], inventory: [
  { id: 'i1', name: 'Pizza bases', stock: 100, unit: 'units' },
  { id: 'i2', name: 'Sauces', stock: 100, unit: 'bottles' },
  { id: 'i3', name: 'Cheese', stock: 100, unit: 'portions' },
  { id: 'i4', name: 'Vegetables', stock: 100, unit: 'portions' }
] };
async function loadLocal() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { local = JSON.parse(await fs.readFile(DATA_FILE, 'utf8')); }
  catch {
    const hash = await bcrypt.hash('Admin123!', 10);
    local.users.push({ id: 'admin-seed', name: 'SliceCraft Admin', email: 'admin@slicecraft.local', password: hash, role: 'admin' });
    await saveLocal();
  }
}
async function saveLocal() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(local, null, 2));
}
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const cleanUser = u => ({ id: String(u.id || u._id), name: u.name, email: u.email, role: u.role });
async function findUserByEmail(email) {
  return useMongo ? User.findOne({ email: email.toLowerCase() }) : local.users.find(u => u.email === email.toLowerCase());
}
async function findUserById(id) {
  return useMongo ? User.findById(id) : local.users.find(u => u.id === id);
}
function tokenFor(u) { return jwt.sign({ id: String(u.id || u._id), role: u.role }, JWT_SECRET, { expiresIn: '7d' }); }
async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ message: 'Please log in to continue.' });
    req.auth = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(req.auth.id);
    if (!user) return res.status(401).json({ message: 'Session expired. Please log in again.' });
    req.user = user; next();
  } catch { return res.status(401).json({ message: 'Session expired. Please log in again.' }); }
}
const adminOnly = (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ message: 'Admin access only.' });

const menu = [
  { id: 'margherita', name: 'Classic Margherita', category: 'Classic', price: 249, desc: 'Tomato, mozzarella, fresh basil', emoji: '🍕', tag: 'Bestseller' },
  { id: 'farmhouse', name: 'Garden Farmhouse', category: 'Veggie', price: 329, desc: 'Capsicum, onion, sweet corn, olives', emoji: '🌿', tag: 'Fresh pick' },
  { id: 'pepper', name: 'Pepper Paneer', category: 'Signature', price: 349, desc: 'Tandoori paneer, peppers, red onion', emoji: '🧀', tag: 'Fan favourite' },
  { id: 'spicy', name: 'Fiery Veggie', category: 'Spicy', price: 299, desc: 'Jalapeño, chilli flakes, smoky sauce', emoji: '🌶️', tag: 'Spicy' },
  { id: 'fourcheese', name: 'Four Cheese Melt', category: 'Signature', price: 379, desc: 'Mozzarella, cheddar, parmesan, gouda', emoji: '🧀', tag: 'Extra cheesy' },
  { id: 'corn', name: 'Golden Corn', category: 'Classic', price: 229, desc: 'Sweet corn, mozzarella, herb butter', emoji: '🌽', tag: 'Easy favourite' }
];

app.get('/api/health', (_, res) => res.json({ ok: true, storage: useMongo ? 'mongodb' : 'local-json' }));
app.get('/api/menu', (_, res) => res.json(menu));

app.post('/api/auth/signup', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (name.length < 2) return res.status(400).json({ message: 'Please enter your name (at least 2 characters).' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must contain at least 6 characters.' });
    if (await findUserByEmail(email)) return res.status(409).json({ message: 'This email is already registered. Please log in instead.' });
    const hashed = await bcrypt.hash(password, 10);
    const user = useMongo
      ? await User.create({ name, email, password: hashed, role: 'user' })
      : { id: uid(), name, email, password: hashed, role: 'user' };
    if (!useMongo) { local.users.push(user); await saveLocal(); }
    res.status(201).json({ token: tokenFor(user), user: cleanUser(user) });
  } catch (e) { res.status(500).json({ message: 'Could not create account. Please try again.' }); }
});
app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await findUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Email or password is incorrect.' });
    res.json({ token: tokenFor(user), user: cleanUser(user) });
  } catch { res.status(500).json({ message: 'Login failed. Please try again.' }); }
});
app.get('/api/auth/me', auth, (req, res) => res.json({ user: cleanUser(req.user) }));
app.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await findUserByEmail(email);
  // Development-only convenience: no email provider required.
  const resetToken = user ? jwt.sign({ id: String(user.id || user._id), purpose: 'reset' }, JWT_SECRET, { expiresIn: '15m' }) : null;
  res.json({ message: 'If the account exists, a reset link is ready in development mode.', resetToken });
});
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const payload = jwt.verify(String(req.body.token || ''), JWT_SECRET);
    if (payload.purpose !== 'reset') return res.status(400).json({ message: 'Invalid reset link.' });
    const password = String(req.body.password || '');
    if (password.length < 6) return res.status(400).json({ message: 'Password must contain at least 6 characters.' });
    const user = await findUserById(payload.id);
    if (!user) return res.status(400).json({ message: 'Account not found.' });
    user.password = await bcrypt.hash(password, 10);
    if (useMongo) await user.save(); else await saveLocal();
    res.json({ message: 'Password updated. You can now log in.' });
  } catch { res.status(400).json({ message: 'Reset link is invalid or expired. Request a new one.' }); }
});

app.get('/api/orders/mine', auth, async (req, res) => {
  const orders = useMongo ? await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }) : local.orders.filter(o => o.userId === req.user.id).reverse();
  res.json(orders);
});
app.post('/api/orders', auth, async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ message: 'Your cart is empty.' });
    const safeItems = items.map(i => ({ id: String(i.id), name: String(i.name), qty: Math.max(1, Math.min(20, Number(i.qty) || 1)), price: Math.max(0, Number(i.price) || 0) }));
    const subtotal = safeItems.reduce((sum, i) => sum + i.price * i.qty, 0);
    const deliveryFee = subtotal >= 499 ? 0 : 39;
    const total = subtotal + deliveryFee;
    const allowedPaymentMethods = ['UPI', 'Net Banking', 'Card', 'Cash on Delivery'];
    const paymentMethod = allowedPaymentMethods.includes(req.body.paymentMethod) ? req.body.paymentMethod : 'UPI';
    const rawAddress = req.body.deliveryAddress || {};
    const deliveryAddress = { phone: String(rawAddress.phone || '').trim(), address: String(rawAddress.address || '').trim(), city: String(rawAddress.city || '').trim(), pincode: String(rawAddress.pincode || '').trim() };
    if (deliveryAddress.phone.length < 10 || deliveryAddress.address.length < 8 || !deliveryAddress.city || !/^\d{6}$/.test(deliveryAddress.pincode)) return res.status(400).json({ message: 'Please complete your phone number and delivery address.' });
    const paymentStatus = paymentMethod === 'Cash on Delivery' ? 'Pay on delivery' : 'Demo - not charged';
    const order = { id: uid(), userId: String(req.user.id || req.user._id), customerName: req.user.name, customerEmail: req.user.email, items: safeItems, subtotal, deliveryFee, total, paymentMethod, paymentStatus, deliveryAddress, status: 'Order Received', createdAt: new Date().toISOString() };
    if (useMongo) {
      const created = await Order.create({ userId: req.user._id, customerName: order.customerName, customerEmail: order.customerEmail, items: safeItems, subtotal, deliveryFee, total, paymentMethod, paymentStatus, deliveryAddress, status: order.status });
      return res.status(201).json({ ...created.toObject(), id: String(created._id) });
    }
    local.orders.push(order);
    const decrement = Math.max(1, safeItems.reduce((n, i) => n + i.qty, 0));
    local.inventory.forEach(item => { item.stock = Math.max(0, item.stock - decrement); });
    await saveLocal();
    res.status(201).json(order);
  } catch { res.status(500).json({ message: 'Could not place order.' }); }
});
app.get('/api/admin/overview', auth, adminOnly, async (req, res) => {
  if (useMongo) {
    const [orders, inventory, users] = await Promise.all([Order.find().sort({ createdAt: -1 }), Inventory.find(), User.countDocuments({ role: 'user' })]);
    return res.json({ orders, inventory, users, lowStock: inventory.filter(i => i.stock < 20) });
  }
  res.json({ orders: [...local.orders].reverse(), inventory: local.inventory, users: local.users.filter(u => u.role === 'user').length, lowStock: local.inventory.filter(i => i.stock < 20) });
});
app.patch('/api/admin/inventory/:id', auth, adminOnly, async (req, res) => {
  const stock = Number(req.body.stock);
  if (!Number.isInteger(stock) || stock < 0 || stock > 100000) return res.status(400).json({ message: 'Stock must be a whole number from 0 to 100000.' });
  if (useMongo) {
    const item = await Inventory.findByIdAndUpdate(req.params.id, { stock }, { new: true });
    if (!item) return res.status(404).json({ message: 'Inventory item not found.' });
    return res.json(item);
  }
  const item = local.inventory.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ message: 'Inventory item not found.' });
  item.stock = stock; await saveLocal(); res.json(item);
});
app.patch('/api/admin/orders/:id', auth, adminOnly, async (req, res) => {
  const allowed = ['Order Received', 'In Kitchen', 'Sent to Delivery', 'Delivered', 'Cancelled'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'Choose a valid order status.' });
  if (useMongo) {
    const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    return res.json(order);
  }
  const order = local.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  order.status = req.body.status; await saveLocal(); res.json(order);
});

async function start() {
  if (useMongo) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    } catch (err) {
      console.warn('MongoDB not reachable (' + err.message + '). Falling back to local JSON storage so login still works.');
      useMongo = false;
    }
  }
  if (useMongo) {
    await Promise.all([
      ...[
        ['Pizza bases', 100, 'units'], ['Sauces', 100, 'bottles'], ['Cheese', 100, 'portions'], ['Vegetables', 100, 'portions']
      ].map(([name, stock, unit]) => Inventory.updateOne({ name }, { $setOnInsert: { name, stock, unit } }, { upsert: true }))
    ]);
    const admin = await User.findOne({ email: 'admin@slicecraft.local' });
    if (!admin) await User.create({ name: 'SliceCraft Admin', email: 'admin@slicecraft.local', password: await bcrypt.hash('Admin123!', 10), role: 'admin' });
  } else {
    await loadLocal();
  }
  app.listen(PORT, () => console.log(`SliceCraft API running at http://localhost:${PORT} (${useMongo ? 'MongoDB' : 'local JSON'} storage)`));
}
start().catch(err => { console.error('Startup failed:', err.message); process.exit(1); });
