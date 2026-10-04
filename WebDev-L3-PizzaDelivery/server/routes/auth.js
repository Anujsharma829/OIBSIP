// Register, verify email, login, forgot/reset password, profile, admin login.
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const User = require('../models/User');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const { wrap, fail } = require('../utils/helpers');
const { sendMail } = require('../utils/mailer');
const { JWT_SECRET, CLIENT_URL } = require('../config');

const router = express.Router();

// Creates the login token (JWT) that the browser keeps for 7 days.
const makeToken = (user) => jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

// ---------- 1. Register ----------
router.post(
  '/auth/register',
  wrap(async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password || password.length < 6) {
      fail('Name, email and a 6+ character password are required');
    }
    if (await User.findOne({ email })) {
      fail('This email is already registered');
    }

    // Random text that goes into the verification link.
    const token = crypto.randomBytes(24).toString('hex');

    await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10), // never store the real password
      token,
      tokenExp: Date.now() + 24 * 60 * 60 * 1000, // link valid for 24 hours
    });

    await sendMail(
      email,
      'Verify your email',
      `<p>Hi ${name}, welcome to Slice Society!</p><p><a href="${CLIENT_URL}/verify/${token}">Verify my email</a></p>`
    );

    res.json({ message: 'Account created. Check your email for the verification link.' });
  })
);

// ---------- 2. Verify email (the link in the email opens this) ----------
router.get(
  '/auth/verify/:token',
  wrap(async (req, res) => {
    const user = await User.findOne({ token: req.params.token, tokenExp: { $gt: Date.now() } });
    if (!user) fail('This link is invalid or has expired');

    user.verified = true;
    user.token = undefined;
    await user.save();

    res.json({ message: 'Email verified. You can log in now.' });
  })
);

// ---------- 3. User login ----------
router.post(
  '/auth/login',
  wrap(async (req, res) => {
    // role: 'user' means an admin account can NOT log in here.
    const user = await User.findOne({ email: req.body.email, role: 'user' });

    const passwordOk = user && (await bcrypt.compare(req.body.password || '', user.password));
    if (!passwordOk) fail('Wrong email or password', 401);

    if (!user.verified) fail('Please verify your email first', 403);

    res.json({ token: makeToken(user), user: { id: user._id, name: user.name, role: user.role } });
  })
);

// ---------- 4. Forgot password: email a reset link ----------
router.post(
  '/auth/forgot',
  wrap(async (req, res) => {
    const user = await User.findOne({ email: req.body.email, role: 'user' });

    if (user) {
      user.token = crypto.randomBytes(24).toString('hex');
      user.tokenExp = Date.now() + 60 * 60 * 1000; // valid for 1 hour
      await user.save();

      await sendMail(
        user.email,
        'Reset your password',
        `<p>Click to set a new password (valid 1 hour):</p><a href="${CLIENT_URL}/reset/${user.token}">Reset password</a>`
      );
    }

    // Same answer even if the email does not exist (so nobody can guess which emails are registered).
    res.json({ message: 'If that email exists, a reset link is on its way.' });
  })
);

// ---------- 5. Reset password (from the link in that email) ----------
router.post(
  '/auth/reset/:token',
  wrap(async (req, res) => {
    const user = await User.findOne({ token: req.params.token, tokenExp: { $gt: Date.now() } });

    if (!user || !req.body.password || req.body.password.length < 6) {
      fail('Invalid link or password too short');
    }

    user.password = await bcrypt.hash(req.body.password, 10);
    user.token = undefined;
    await user.save();

    res.json({ message: 'Password updated. Please log in.' });
  })
);

// ---------- 6. Separate admin login (only role 'admin' can use it) ----------
router.post(
  '/admin/login',
  wrap(async (req, res) => {
    const admin = await User.findOne({ email: req.body.email, role: 'admin' });

    const passwordOk = admin && (await bcrypt.compare(req.body.password || '', admin.password));
    if (!passwordOk) fail('Wrong admin credentials', 401);

    res.json({ token: makeToken(admin), user: { id: admin._id, name: admin.name, role: 'admin' } });
  })
);

// ---------- 7. Profile page ----------
router.get(
  '/auth/me',
  auth(),
  wrap(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) fail('Account not found', 404);

    const orders = await Order.countDocuments({ user: user._id, paid: true });
    res.json({ name: user.name, email: user.email, role: user.role, orders });
  })
);

router.put(
  '/auth/me',
  auth(),
  wrap(async (req, res) => {
    const name = (req.body.name || '').trim();
    if (name.length < 2) fail('Please enter your name');

    const user = await User.findByIdAndUpdate(req.user.id, { name }, { new: true });
    res.json({ name: user.name });
  })
);

router.put(
  '/auth/password',
  auth(),
  wrap(async (req, res) => {
    const user = await User.findById(req.user.id);

    if (!(await bcrypt.compare(req.body.current || '', user.password))) {
      fail('Current password is wrong');
    }
    if ((req.body.password || '').length < 6) {
      fail('New password must be 6+ characters');
    }

    user.password = await bcrypt.hash(req.body.password, 10);
    await user.save();

    res.json({ message: 'Password changed' });
  })
);

module.exports = router;
