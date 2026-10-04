const rateLimit = require('express-rate-limit');
const config = require('../config');
const { security } = require('../utils/logger');

const handler = (req, res, next, options) => {
  security('rate_limit_exceeded', req);
  res.status(options.statusCode).json({ error: { code: 'rate_limited', message: 'Too many requests, please try again later' } });
};

// Global limiter.
const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
  skip: (req) => req.path === '/health',
});

// Stricter limiter for credential endpoints (brute force protection).
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.authMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler,
});

module.exports = { globalLimiter, authLimiter };
