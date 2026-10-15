import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import cron from 'node-cron';
import Razorpay from 'razorpay';

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-this-secret';
const DEFAULT_THRESHOLD = Number(process.env.LOW_STOCK_THRESHOLD) || 20;
const STOCK_CRON = process.env.STOCK_CRON || '*/5 * * * *'; // every 5 minutes
const ADMIN_SEED_EMAIL = 'admin@slicecraft.local';
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
let useMongo = Boolean(process.env.MONGODB_URI);

app.use(cors({ origin: true })); // allow localhost, 127.0.0.1 and LAN URLs on any port
app.use(express.json({ limit: '1mb' }));

/* ------------------------------------------------------------------ */
/* Email (Nodemailer)                                                  */
/* ------------------------------------------------------------------ */
const smtpConfigured = Boolean(
  (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ||
  (process.env.EMAIL_USER && process.env.EMAIL_PASS)
);
const transporter = !smtpConfigured ? null : process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
  : nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
const MAIL_FROM = process.env.MAIL_FROM || `SliceCraft <${process.env.EMAIL_USER || process.env.SMTP_USER || 'no-reply@slicecraft.local'}>`;

async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    console.log(`\n[EMAIL - SMTP not configured, printed here instead]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
    return { sent: false };
  }
  try {
    await transporter.sendMail({ from: MAIL_FROM, to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.error('[EMAIL] sending failed:', err.message);
    return { sent: false, error: err.message };
  }
}
const mailShell = (title, body) => `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px"><h2 style="color:#e85b2a;margin-top:0">🍕 SliceCraft</h2><h3>${title}</h3>${body}<p style="color:#999;font-size:12px;margin-top:24px">If you did not request this, you can ignore this email.</p></div>`;

/* ------------------------------------------------------------------ */
/* Razorpay (test mode)                                                */
/* ------------------------------------------------------------------ */
const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const razorpayEnabled = Boolean(RZP_KEY_ID && RZP_KEY_SECRET);
const razorpay = razorpayEnabled ? new Razorpay({ key_id: RZP_KEY_ID, key_secret: RZP_KEY_SECRET }) : null;

/* ------------------------------------------------------------------ */
/* Mongo models                                                        */
/* ------------------------------------------------------------------ */
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  verified: { type: Boolean, default: true },
  verifyToken: { type: String, default: '' }
}, { timestamps: true });
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName: String, customerEmail: String, items: Array, subtotal: Number, deliveryFee: Number, total: Number,
  paymentMethod: { type: String, default: 'Razorpay' }, paymentStatus: { type: String, default: 'Awaiting payment' },
  razorpayOrderId: String, razorpayPaymentId: String, stockApplied: { type: Boolean, default: false },
  deliveryAddress: { phone: String, address: String, city: String, pincode: String },
  status: { type: String, default: 'Order Received' }
}, { timestamps: true });
const inventorySchema = new mongoose.Schema({
  name: { type: String, unique: true }, stock: { type: Number, default: 100 }, unit: { type: String, default: 'units' },
  threshold: { type: Number, default: DEFAULT_THRESHOLD }, lowAlertSent: { type: Boolean, default: false }
});
const alertSchema = new mongoose.Schema({ message: String, emailed: Boolean }, { timestamps: true });
const User = mongoose.model('User', userSchema);
const Order = mongoose.model('Order', orderSchema);
const Inventory = mongoose.model('Inventory', inventorySchema);
const Alert = mongoose.model('Alert', alertSchema);

/* ------------------------------------------------------------------ */
/* Local JSON storage (used when MONGODB_URI is not set / unreachable) */
/* ------------------------------------------------------------------ */
const DEFAULT_INVENTORY = [
  ['Pizza bases', 100, 'units'], ['Sauces', 100, 'bottles'], ['Cheese', 100, 'portions'], ['Vegetables', 100, 'portions']
];
let local = { users: [], orders: [], inventory: [], alerts: [] };
let writeQueue = Promise.resolve();
const uid = () => crypto.randomBytes(9).toString('hex');
const nowIso = () => new Date().toISOString();

async function saveLocal() {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const tmp = `${DATA_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(local, null, 2));
    await fs.rename(tmp, DATA_FILE);
  }).catch(err => console.error('Could not save local data:', err.message));
  return writeQueue;
}
async function loadLocal() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    local = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') { // corrupt file: keep a backup instead of silently losing accounts
      await fs.copyFile(DATA_FILE, `${DATA_FILE}.broken-${Date.now()}`).catch(() => {});
    }
    local = { users: [], orders: [], inventory: [], alerts: [] };
  }
  local.users ||= []; local.orders ||= []; local.inventory ||= []; local.alerts ||= [];
  for (const [name, stock, unit] of DEFAULT_INVENTORY) {
    if (!local.inventory.some(i => i.name === name)) local.inventory.push({ id: uid(), name, stock, unit });
  }
  local.inventory.forEach(i => { if (!Number.isFinite(i.threshold)) i.threshold = DEFAULT_THRESHOLD; if (typeof i.lowAlertSent !== 'boolean') i.lowAlertSent = false; });
  if (!local.users.some(u => u.email === ADMIN_SEED_EMAIL)) {
    local.users.push({ id: 'admin-seed', name: 'SliceCraft Admin', email: ADMIN_SEED_EMAIL, password: await bcrypt.hash('Admin123!', 10), role: 'admin', verified: true });
  }
  await saveLocal();
}

/* ------------------------------------------------------------------ */
/* Tiny repository layer so every route works with Mongo AND JSON      */
/* ------------------------------------------------------------------ */
const norm = d => {
  if (!d) return null;
  const o = typeof d.toObject === 'function' ? d.toObject() : { ...d };
  o.id = String(o._id ?? o.id);
  if (o.userId) o.userId = String(o.userId);
  delete o._id; delete o.__v;
  return o;
};
const validId = id => !useMongo || mongoose.isValidObjectId(id);
const sortNewest = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);

const repo = {
  users: {
    byEmail: async email => norm(useMongo ? await User.findOne({ email }) : local.users.find(u => u.email === email)),
    byId: async id => !validId(id) ? null : norm(useMongo ? await User.findById(id) : local.users.find(u => u.id === id)),
    byVerifyToken: async token => !token ? null : norm(useMongo ? await User.findOne({ verifyToken: token }) : local.users.find(u => u.verifyToken === token)),
    create: async data => {
      if (useMongo) return norm(await User.create(data));
      const u = { id: uid(), ...data, createdAt: nowIso() };
      local.users.push(u); await saveLocal(); return norm(u);
    },
    update: async (id, patch) => {
      if (useMongo) return norm(await User.findByIdAndUpdate(id, patch, { new: true }));
      const u = local.users.find(x => x.id === id); if (!u) return null;
      Object.assign(u, patch); await saveLocal(); return norm(u);
    },
    countCustomers: async () => useMongo ? User.countDocuments({ role: 'user' }) : local.users.filter(u => u.role === 'user').length
  },
  orders: {
    create: async data => {
      if (useMongo) return norm(await Order.create(data));
      const o = { id: uid(), ...data, createdAt: nowIso(), updatedAt: nowIso() };
      local.orders.push(o); await saveLocal(); return norm(o);
    },
    byUser: async userId => useMongo
      ? (await Order.find({ userId }).sort({ createdAt: -1 })).map(norm)
      : local.orders.filter(o => o.userId === userId).map(norm).sort(sortNewest),
    all: async () => useMongo ? (await Order.find().sort({ createdAt: -1 })).map(norm) : local.orders.map(norm).sort(sortNewest),
    byId: async id => !validId(id) ? null : norm(useMongo ? await Order.findById(id) : local.orders.find(o => o.id === id)),
    update: async (id, patch) => {
      if (useMongo) return norm(await Order.findByIdAndUpdate(id, patch, { new: true }));
      const o = local.orders.find(x => x.id === id); if (!o) return null;
      Object.assign(o, patch, { updatedAt: nowIso() }); await saveLocal(); return norm(o);
    }
  },
  inventory: {
    all: async () => {
      const rows = (useMongo ? await Inventory.find() : local.inventory).map(norm);
      const order = DEFAULT_INVENTORY.map(i => i[0]);
      return rows.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
    },
    byId: async id => !validId(id) ? null : norm(useMongo ? await Inventory.findById(id) : local.inventory.find(i => i.id === id)),
    update: async (id, patch) => {
      if (useMongo) return norm(await Inventory.findByIdAndUpdate(id, patch, { new: true }));
      const i = local.inventory.find(x => x.id === id); if (!i) return null;
      Object.assign(i, patch); await saveLocal(); return norm(i);
    }
  },
  alerts: {
    add: async (message, emailed) => {
      if (useMongo) return norm(await Alert.create({ message, emailed }));
      local.alerts.unshift({ id: uid(), message, emailed, createdAt: nowIso() });
      local.alerts = local.alerts.slice(0, 50); await saveLocal();
    },
    recent: async () => useMongo ? (await Alert.find().sort({ createdAt: -1 }).limit(10)).map(norm) : local.alerts.slice(0, 10)
  }
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */
const cleanUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const isVerified = u => u.verified !== false; // accounts created before verification existed count as verified
const tokenFor = u => jwt.sign({ id: u.id, role: u.role }, JWT_SECRET, { expiresIn: '7d' });
const baseUrl = req => (req.headers.origin || CLIENT_URL).replace(/\/$/, '');
const thresholdOf = i => Number.isFinite(i.threshold) ? i.threshold : DEFAULT_THRESHOLD;
const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ message: 'Please log in to continue.' });
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await repo.users.byId(payload.id);
    if (!user) return res.status(401).json({ message: 'Session expired. Please log in again.' });
    req.user = user; next();
  } catch { return res.status(401).json({ message: 'Session expired. Please log in again.' }); }
}
const adminOnly = (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ message: 'Admin access only.' });
const wrap = fn => (req, res) => fn(req, res).catch(err => { console.error(err); res.status(500).json({ message: 'Something went wrong on the server. Please try again.' }); });

/* ------------------------------------------------------------------ */
/* Menu                                                                */
/* ------------------------------------------------------------------ */
const menu = [
  { id: 'margherita', name: 'Classic Margherita', category: 'Classic', price: 249, desc: 'Tomato, mozzarella, fresh basil', emoji: '🍕', tag: 'Bestseller' },
  { id: 'farmhouse', name: 'Garden Farmhouse', category: 'Veggie', price: 329, desc: 'Capsicum, onion, sweet corn, olives', emoji: '🌿', tag: 'Fresh pick' },
  { id: 'pepper', name: 'Pepper Paneer', category: 'Signature', price: 349, desc: 'Tandoori paneer, peppers, red onion', emoji: '🧀', tag: 'Fan favourite' },
  { id: 'spicy', name: 'Fiery Veggie', category: 'Spicy', price: 299, desc: 'Jalapeño, chilli flakes, smoky sauce', emoji: '🌶️', tag: 'Spicy' },
  { id: 'fourcheese', name: 'Four Cheese Melt', category: 'Signature', price: 379, desc: 'Mozzarella, cheddar, parmesan, gouda', emoji: '🧀', tag: 'Extra cheesy' },
  { id: 'corn', name: 'Golden Corn', category: 'Classic', price: 229, desc: 'Sweet corn, mozzarella, herb butter', emoji: '🌽', tag: 'Easy favourite' }
];

app.get('/api/health', (_, res) => res.json({ ok: true, storage: useMongo ? 'mongodb' : 'local-json', email: smtpConfigured ? 'smtp' : 'console', payments: razorpayEnabled ? 'razorpay-test' : 'demo' }));
app.get('/api/config', (_, res) => res.json({ paymentMode: razorpayEnabled ? 'razorpay' : 'demo', emailMode: smtpConfigured ? 'smtp' : 'console', defaultThreshold: DEFAULT_THRESHOLD, stockCron: STOCK_CRON }));
app.get('/api/menu', (_, res) => res.json(menu));

/* ------------------------------------------------------------------ */
/* Auth: signup + email verification, login, admin login, reset        */
/* ------------------------------------------------------------------ */
async function sendVerification(req, user) {
  const link = `${baseUrl(req)}/?verify=${user.verifyToken}`;
  const result = await sendMail({
    to: user.email,
    subject: 'Verify your SliceCraft account',
    text: `Hi ${user.name}, please verify your email by opening this link: ${link}`,
    html: mailShell('Verify your email', `<p>Hi ${user.name}, welcome to SliceCraft! Please confirm your email address to activate your account.</p><p><a href="${link}" style="background:#e85b2a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Verify my email</a></p><p style="font-size:12px;color:#777">Or paste this link in your browser:<br>${link}</p>`)
  });
  // When real email could not be delivered (no SMTP set up), expose the link so development is never blocked.
  return { emailed: result.sent, devLink: result.sent ? undefined : link };
}

app.post('/api/auth/signup', wrap(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (name.length < 2) return res.status(400).json({ message: 'Please enter your name (at least 2 characters).' });
  if (!isEmail(email)) return res.status(400).json({ message: 'Please enter a valid email address.' });
  if (password.length < 6) return res.status(400).json({ message: 'Password must contain at least 6 characters.' });
  if (await repo.users.byEmail(email)) return res.status(409).json({ message: 'This email is already registered. Please log in instead.' });
  let user;
  try {
    user = await repo.users.create({ name, email, password: await bcrypt.hash(password, 10), role: 'user', verified: false, verifyToken: crypto.randomBytes(24).toString('hex') });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'This email is already registered. Please log in instead.' });
    throw err;
  }
  const { emailed, devLink } = await sendVerification(req, user);
  res.status(201).json({ needsVerification: true, email, emailed, devLink, message: emailed ? 'Account created! We sent a verification link to your email.' : 'Account created! Email sending is not configured, so use the verification link below.' });
}));

app.post('/api/auth/verify-email', wrap(async (req, res) => {
  const user = await repo.users.byVerifyToken(String(req.body.token || ''));
  if (!user) return res.status(400).json({ message: 'This verification link is invalid or was already used. Try logging in.' });
  const updated = await repo.users.update(user.id, { verified: true, verifyToken: '' });
  res.json({ message: 'Email verified! Welcome to SliceCraft.', token: tokenFor(updated), user: cleanUser(updated) });
}));

app.post('/api/auth/resend-verification', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = await repo.users.byEmail(email);
  if (!user || isVerified(user)) return res.json({ message: 'If this account needs verification, a new link has been prepared.' });
  const fresh = await repo.users.update(user.id, { verifyToken: crypto.randomBytes(24).toString('hex') });
  const { emailed, devLink } = await sendVerification(req, fresh);
  res.json({ emailed, devLink, message: emailed ? 'A new verification link has been emailed to you.' : 'Email sending is not configured, so use the verification link below.' });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await repo.users.byEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Email or password is incorrect.' });
  if (user.role === 'admin') return res.status(403).json({ message: 'Admin accounts must sign in from the separate Admin Login page.' });
  if (!isVerified(user)) return res.status(403).json({ message: 'Please verify your email before logging in.', needsVerification: true, email });
  res.json({ token: tokenFor(user), user: cleanUser(user) });
}));

app.post('/api/auth/admin-login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await repo.users.byEmail(email);
  if (!user || user.role !== 'admin' || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Invalid admin credentials.' });
  res.json({ token: tokenFor(user), user: cleanUser(user) });
}));

app.get('/api/auth/me', auth, (req, res) => res.json({ user: cleanUser(req.user) }));

const resetSig = user => user.password.slice(-10); // makes each reset link single-use (it changes once the password changes)
app.post('/api/auth/forgot-password', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = isEmail(email) ? await repo.users.byEmail(email) : null;
  const generic = 'If an account exists for this email, a password reset link has been sent.';
  if (!user) return res.json({ message: generic });
  const token = jwt.sign({ id: user.id, purpose: 'reset', sig: resetSig(user) }, JWT_SECRET, { expiresIn: '15m' });
  const link = `${baseUrl(req)}/?reset=${token}`;
  const result = await sendMail({
    to: user.email,
    subject: 'Reset your SliceCraft password',
    text: `Reset your password using this link (valid for 15 minutes): ${link}`,
    html: mailShell('Reset your password', `<p>Click the button below to choose a new password. This link is valid for 15 minutes.</p><p><a href="${link}" style="background:#e85b2a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Reset password</a></p><p style="font-size:12px;color:#777">Or paste this link in your browser:<br>${link}</p>`)
  });
  res.json({ message: result.sent ? generic : 'Email sending is not configured, so use the reset link below.', devLink: result.sent ? undefined : link });
}));

app.post('/api/auth/reset-password', wrap(async (req, res) => {
  let payload;
  try { payload = jwt.verify(String(req.body.token || ''), JWT_SECRET); }
  catch { return res.status(400).json({ message: 'Reset link is invalid or expired. Request a new one.' }); }
  if (payload.purpose !== 'reset') return res.status(400).json({ message: 'Invalid reset link.' });
  const password = String(req.body.password || '');
  if (password.length < 6) return res.status(400).json({ message: 'Password must contain at least 6 characters.' });
  const user = await repo.users.byId(payload.id);
  if (!user || resetSig(user) !== payload.sig) return res.status(400).json({ message: 'This reset link was already used or is no longer valid. Request a new one.' });
  await repo.users.update(user.id, { password: await bcrypt.hash(password, 10) });
  res.json({ message: 'Password updated. You can now log in.' });
}));

/* ------------------------------------------------------------------ */
/* Inventory helpers + low-stock job                                   */
/* ------------------------------------------------------------------ */
async function applyStock(order) {
  if (order.stockApplied) return;
  const qty = (order.items || []).reduce((n, i) => n + i.qty, 0) || 1;
  for (const item of await repo.inventory.all()) await repo.inventory.update(item.id, { stock: Math.max(0, item.stock - qty) });
  await repo.orders.update(order.id, { stockApplied: true });
  checkLowStock().catch(err => console.error('Stock check failed:', err.message));
}

let checking = false;
async function checkLowStock() {
  if (checking) return { alerted: [] };
  checking = true;
  try {
    const inventory = await repo.inventory.all();
    for (const i of inventory) { // stock refilled -> allow a fresh alert next time
      if (i.lowAlertSent && i.stock >= thresholdOf(i)) await repo.inventory.update(i.id, { lowAlertSent: false });
    }
    const low = inventory.filter(i => i.stock < thresholdOf(i) && !i.lowAlertSent);
    if (!low.length) return { alerted: [] };
    const lines = low.map(i => `${i.name}: ${i.stock} ${i.unit} left (threshold ${thresholdOf(i)})`);
    const adminUser = (useMongo ? await User.findOne({ role: 'admin' }) : local.users.find(u => u.role === 'admin'));
    const to = process.env.ADMIN_EMAIL || process.env.EMAIL_USER || process.env.SMTP_USER || adminUser?.email || ADMIN_SEED_EMAIL;
    const result = await sendMail({
      to,
      subject: `⚠️ SliceCraft low stock alert (${low.length} item${low.length > 1 ? 's' : ''})`,
      text: `These inventory items are below their threshold:\n\n${lines.join('\n')}\n\nPlease restock from the admin dashboard.`,
      html: mailShell('Low stock alert', `<p>These inventory items are below their threshold:</p><ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul><p>Please restock from the admin dashboard.</p>`)
    });
    for (const i of low) await repo.inventory.update(i.id, { lowAlertSent: true });
    await repo.alerts.add(`Low stock → ${lines.join(' | ')}${result.sent ? ` (email sent to ${to})` : ' (email not configured - printed in server console)'}`, result.sent);
    return { alerted: lines, emailed: result.sent, to };
  } finally { checking = false; }
}

/* ------------------------------------------------------------------ */
/* Orders + Razorpay payments                                          */
/* ------------------------------------------------------------------ */
const ONLINE = ['Razorpay', 'UPI', 'Net Banking', 'Card'];
app.get('/api/orders/mine', auth, wrap(async (req, res) => res.json(await repo.orders.byUser(req.user.id))));

app.post('/api/orders', auth, wrap(async (req, res) => {
  const rawItems = Array.isArray(req.body.items) ? req.body.items : [];
  if (!rawItems.length) return res.status(400).json({ message: 'Your cart is empty.' });
  const items = [];
  for (const i of rawItems) {
    const qty = Math.max(1, Math.min(20, Number(i.qty) || 1));
    const known = menu.find(m => m.id === i.id);
    if (known) items.push({ id: known.id, name: known.name, qty, price: known.price });
    else if (String(i.id).startsWith('custom-')) items.push({ id: String(i.id).slice(0, 120), name: String(i.name || 'Build-your-own pizza').slice(0, 80), desc: String(i.desc || '').slice(0, 200), qty, price: Math.min(599, Math.max(299, Number(i.price) || 299)) });
    else return res.status(400).json({ message: 'One of the items in your cart is no longer available.' });
  }
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const deliveryFee = subtotal >= 499 ? 0 : 39;
  const total = subtotal + deliveryFee;
  const method = req.body.paymentMethod === 'Cash on Delivery' ? 'Cash on Delivery' : ONLINE.includes(req.body.paymentMethod) ? 'Razorpay' : null;
  if (!method) return res.status(400).json({ message: 'Choose a valid payment method.' });
  const a = req.body.deliveryAddress || {};
  const deliveryAddress = { phone: String(a.phone || '').trim(), address: String(a.address || '').trim(), city: String(a.city || '').trim(), pincode: String(a.pincode || '').trim() };
  if (deliveryAddress.phone.length < 10 || deliveryAddress.address.length < 8 || !deliveryAddress.city || !/^\d{6}$/.test(deliveryAddress.pincode)) return res.status(400).json({ message: 'Please complete your phone number and delivery address.' });

  const base = { userId: req.user.id, customerName: req.user.name, customerEmail: req.user.email, items, subtotal, deliveryFee, total, paymentMethod: method, deliveryAddress };
  if (method === 'Cash on Delivery') {
    const order = await repo.orders.create({ ...base, paymentStatus: 'Pay on delivery', status: 'Order Received' });
    await applyStock(order);
    return res.status(201).json({ order: await repo.orders.byId(order.id), payment: null });
  }
  const order = await repo.orders.create({ ...base, paymentStatus: 'Awaiting payment', status: 'Payment Pending' });
  let razorpayOrderId = `order_demo_${crypto.randomBytes(7).toString('hex')}`;
  if (razorpayEnabled) {
    try {
      const rp = await razorpay.orders.create({ amount: total * 100, currency: 'INR', receipt: order.id.slice(-30), notes: { orderId: order.id } });
      razorpayOrderId = rp.id;
    } catch (err) {
      await repo.orders.update(order.id, { paymentStatus: 'Payment failed', status: 'Cancelled' });
      console.error('Razorpay order creation failed:', err?.error?.description || err.message);
      return res.status(502).json({ message: 'Razorpay rejected the request. Please check RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in server/.env.' });
    }
  }
  const saved = await repo.orders.update(order.id, { razorpayOrderId });
  res.status(201).json({ order: saved, payment: { mode: razorpayEnabled ? 'razorpay' : 'demo', keyId: razorpayEnabled ? RZP_KEY_ID : undefined, razorpayOrderId, amount: total * 100, currency: 'INR' } });
}));

app.post('/api/payments/verify', auth, wrap(async (req, res) => {
  const { orderId, razorpay_order_id: rpOrder, razorpay_payment_id: rpPayment, razorpay_signature: signature } = req.body;
  const order = await repo.orders.byId(String(orderId || ''));
  if (!order || order.userId !== req.user.id) return res.status(404).json({ message: 'Order not found.' });
  if (order.paymentStatus === 'Paid (Razorpay test)') return res.json({ order });
  if (order.razorpayOrderId !== rpOrder) return res.status(400).json({ message: 'Payment does not match this order.' });
  let ok = false;
  if (razorpayEnabled) {
    const expected = crypto.createHmac('sha256', RZP_KEY_SECRET).update(`${rpOrder}|${rpPayment}`).digest('hex');
    ok = typeof signature === 'string' && signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } else {
    ok = signature === 'demo_success'; // simulated Razorpay "Success" button when no keys are configured
  }
  if (!ok) {
    await repo.orders.update(order.id, { paymentStatus: 'Payment failed', status: 'Cancelled' });
    return res.status(400).json({ message: 'Payment verification failed. Your card was not charged.' });
  }
  const paid = await repo.orders.update(order.id, { paymentStatus: 'Paid (Razorpay test)', status: 'Order Received', razorpayPaymentId: rpPayment || 'pay_demo' });
  await applyStock(paid);
  res.json({ order: await repo.orders.byId(order.id) });
}));

app.post('/api/payments/cancel', auth, wrap(async (req, res) => {
  const order = await repo.orders.byId(String(req.body.orderId || ''));
  if (!order || order.userId !== req.user.id) return res.status(404).json({ message: 'Order not found.' });
  if (order.paymentStatus === 'Awaiting payment') await repo.orders.update(order.id, { paymentStatus: 'Payment cancelled', status: 'Cancelled' });
  res.json({ ok: true });
}));

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */
app.get('/api/admin/overview', auth, adminOnly, wrap(async (req, res) => {
  const [orders, inventory, users, alerts] = await Promise.all([repo.orders.all(), repo.inventory.all(), repo.users.countCustomers(), repo.alerts.recent()]);
  const withThreshold = inventory.map(i => ({ ...i, threshold: thresholdOf(i) }));
  res.json({
    orders: orders.filter(o => o.status !== 'Payment Pending'),
    inventory: withThreshold,
    users,
    lowStock: withThreshold.filter(i => i.stock < i.threshold),
    alerts,
    emailMode: smtpConfigured ? 'smtp' : 'console',
    stockCron: STOCK_CRON
  });
}));

app.patch('/api/admin/inventory/:id', auth, adminOnly, wrap(async (req, res) => {
  const patch = {};
  if (req.body.stock !== undefined) {
    const stock = Number(req.body.stock);
    if (!Number.isInteger(stock) || stock < 0 || stock > 100000) return res.status(400).json({ message: 'Stock must be a whole number from 0 to 100000.' });
    patch.stock = stock;
  }
  if (req.body.threshold !== undefined) {
    const threshold = Number(req.body.threshold);
    if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100000) return res.status(400).json({ message: 'Threshold must be a whole number from 0 to 100000.' });
    patch.threshold = threshold;
  }
  if (!Object.keys(patch).length) return res.status(400).json({ message: 'Nothing to update.' });
  const existing = await repo.inventory.byId(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Inventory item not found.' });
  const nextStock = patch.stock ?? existing.stock;
  const nextThreshold = patch.threshold ?? thresholdOf(existing);
  if (nextStock >= nextThreshold) patch.lowAlertSent = false;
  const item = await repo.inventory.update(existing.id, patch);
  if (nextStock < nextThreshold) checkLowStock().catch(() => {});
  res.json({ ...item, threshold: thresholdOf(item) });
}));

app.post('/api/admin/check-stock', auth, adminOnly, wrap(async (req, res) => res.json(await checkLowStock())));

app.patch('/api/admin/orders/:id', auth, adminOnly, wrap(async (req, res) => {
  const allowed = ['Order Received', 'In Kitchen', 'Sent to Delivery', 'Delivered', 'Cancelled'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ message: 'Choose a valid order status.' });
  const order = await repo.orders.update(req.params.id, { status: req.body.status });
  if (!order) return res.status(404).json({ message: 'Order not found.' });
  res.json(order);
}));

/* ------------------------------------------------------------------ */
/* Startup                                                             */
/* ------------------------------------------------------------------ */
async function start() {
  if (useMongo) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    } catch (err) {
      console.warn(`MongoDB not reachable (${err.message}). Falling back to local JSON storage so the app still works.`);
      useMongo = false;
    }
  }
  if (useMongo) {
    await Promise.all(DEFAULT_INVENTORY.map(([name, stock, unit]) =>
      Inventory.updateOne({ name }, { $setOnInsert: { name, stock, unit, threshold: DEFAULT_THRESHOLD } }, { upsert: true })));
    if (!(await User.findOne({ email: ADMIN_SEED_EMAIL }))) {
      await User.create({ name: 'SliceCraft Admin', email: ADMIN_SEED_EMAIL, password: await bcrypt.hash('Admin123!', 10), role: 'admin', verified: true });
    }
  } else {
    await loadLocal();
  }
  cron.schedule(STOCK_CRON, () => checkLowStock().catch(err => console.error('Scheduled stock check failed:', err.message)));
  app.listen(PORT, () => {
    console.log(`SliceCraft API running at http://localhost:${PORT}`);
    console.log(` - storage : ${useMongo ? 'MongoDB' : 'local JSON (server/data/db.json)'}`);
    console.log(` - email   : ${smtpConfigured ? 'SMTP / Gmail' : 'NOT configured (emails are printed in this console, links shown in the UI)'}`);
    console.log(` - payments: ${razorpayEnabled ? 'Razorpay TEST mode' : 'demo mode (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to use Razorpay)'}`);
    console.log(` - cron    : low-stock check "${STOCK_CRON}"`);
  });
}
start().catch(err => { console.error('Startup failed:', err.message); process.exit(1); });
