const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'motus_super_secret_key_2026';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(req, res, next) {
  // Support both Authorization header AND ?token= query param (needed for SSE EventSource)
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // refresh user from DB to get updated role/plan
    const user = db.getUserById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden. Admin authorization required.' });
  }
  next();
}

function checkPlanLimits(requiredLeadsCount = 1) {
  return (req, res, next) => {
    const user = req.user;
    if (user.role === 'admin') {
      return next(); // Admins have unlimited access
    }

    if (!user.plan || user.plan === 'unassigned' || user.plan === 'none') {
      return res.status(403).json({
        error: 'Service Locked',
        message: 'Your account is pending plan activation by admin. Contact site owner to enable services.',
        code: 'PLAN_UNASSIGNED'
      });
    }

    const today = new Date().toISOString().split('T')[0];
    let scrapedToday = user.scraped_today || 0;
    if (user.last_scraped_date !== today) {
      scrapedToday = 0;
    }

    if (user.plan === 'trial') {
      const DAILY_TRIAL_LIMIT = 1000;
      if (scrapedToday + requiredLeadsCount > DAILY_TRIAL_LIMIT) {
        return res.status(429).json({
          error: 'Daily Trial Limit Reached',
          message: `Trial plan allows up to 1,000 carrier leads per day. You have used ${scrapedToday}/1,000 today. Upgrade to Premium for unlimited access!`,
          code: 'TRIAL_LIMIT_EXCEEDED',
          scrapedToday,
          limit: DAILY_TRIAL_LIMIT
        });
      }
    }

    next();
  };
}

module.exports = {
  generateToken,
  verifyToken,
  requireAdmin,
  checkPlanLimits,
  JWT_SECRET
};
