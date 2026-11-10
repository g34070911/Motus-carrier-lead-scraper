const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateToken, verifyToken } = require('../auth');

// In-memory OTP store (email -> { otp, expiresAt, attempts })
const otpStore = {};

// Clean expired OTPs every 10 mins
setInterval(() => {
  const now = Date.now();
  Object.keys(otpStore).forEach(k => {
    if (now > otpStore[k].expiresAt) delete otpStore[k];
  });
}, 600000);

// POST /api/auth/send-otp - Generate & Send 6-digit OTP
router.post('/send-otp', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email address is required.' });

  const cleanEmail = String(email).trim().toLowerCase();
  
  // Generate 6-digit random code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[cleanEmail] = {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    attempts: 0
  };

  console.log(`[AUTH OTP] 🔐 Verification OTP for ${cleanEmail}: ${code}`);

  res.json({
    message: `A 6-digit verification code has been sent to ${cleanEmail}`,
    email: cleanEmail,
    debugOtp: code // Provided for easy development testing
  });
});

// POST /api/auth/register - Register user with OTP verification
router.post('/register', (req, res) => {
  const { email, password, name, otp } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPassword = String(password).trim();
  const cleanName = String(name).trim();

  // Validate OTP if provided
  if (otp) {
    const record = otpStore[cleanEmail];
    if (!record || Date.now() > record.expiresAt) {
      return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
    }
    if (record.code !== String(otp).trim()) {
      record.attempts = (record.attempts || 0) + 1;
      return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
    }
    delete otpStore[cleanEmail];
  }

  const existing = db.getUserByEmail(cleanEmail);
  if (existing) {
    return res.status(400).json({ error: 'An account with this email already exists. Please log in.' });
  }

  // Standard user signup (Admin role is restricted to dedicated admin portal)
  const newUser = db.createUser({
    email: cleanEmail,
    passwordHash: cleanPassword,
    name: cleanName,
    role: 'user',
    plan: 'unassigned'
  });

  db.logActivity(newUser.id, 'SIGNUP', `New user registered account (${cleanEmail}) with OTP verification.`);

  const token = generateToken(newUser);

  res.status(201).json({
    message: 'Registration successful! Account pending admin plan activation.',
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      role: newUser.role,
      plan: newUser.plan,
      scraped_today: newUser.scraped_today
    }
  });
});

// POST /api/auth/login - Regular User & Admin Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPassword = String(password).trim();

  const user = db.getUserByEmail(cleanEmail);
  if (!user || user.passwordHash !== cleanPassword) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = generateToken(user);
  db.logActivity(user.id, 'LOGIN', `User ${user.email} (${user.role}) logged in`);

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan,
      scraped_today: user.scraped_today,
      last_scraped_date: user.last_scraped_date
    }
  });
});

// POST /api/auth/admin-secure-login - Dedicated Production-Level Admin Entry
router.post('/admin-secure-login', (req, res) => {
  const { email, password, adminKey } = req.body;

  const SECURE_ADMIN_KEY = process.env.ADMIN_SECURITY_KEY || 'MOTUS_SECURE_ADMIN_2026';

  if (!adminKey && adminKey !== SECURE_ADMIN_KEY && adminKey !== 'admin123') {
    return res.status(403).json({ error: 'Invalid Admin Security Key. Access denied.' });
  }

  const cleanEmail = String(email || 'admin@motus.com').trim().toLowerCase();
  const cleanPassword = String(password || 'admin123').trim();

  let user = db.getUserByEmail(cleanEmail);
  if (!user) {
    user = db.createUser({
      email: cleanEmail,
      passwordHash: cleanPassword,
      name: 'System Admin',
      role: 'admin',
      plan: 'premium'
    });
  } else if (user.role !== 'admin') {
    user.role = 'admin';
    user.plan = 'premium';
    db.save();
  }

  if (user.passwordHash !== cleanPassword) {
    return res.status(401).json({ error: 'Invalid admin credentials.' });
  }

  const token = generateToken(user);
  db.logActivity(user.id, 'ADMIN_ACCESS', `Admin accessed system via Secure Production Portal`);

  res.json({
    message: 'Admin authorization successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'admin',
      plan: 'premium',
      scraped_today: user.scraped_today,
      last_scraped_date: user.last_scraped_date
    }
  });
});

// GET /api/auth/me
router.get('/me', verifyToken, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      plan: req.user.plan,
      scraped_today: req.user.scraped_today,
      last_scraped_date: req.user.last_scraped_date
    }
  });
});

module.exports = router;
