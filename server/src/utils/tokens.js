const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

const signAccess = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, config.jwtSecret, {
    expiresIn: config.accessTtl,
  });

const verifyAccess = (token) => jwt.verify(token, config.jwtSecret);

const signRefresh = (user) =>
  jwt.sign({ id: user.id, jti: crypto.randomUUID() }, config.jwtRefreshSecret, {
    expiresIn: `${config.refreshTtlDays}d`,
  });

const verifyRefresh = (token) => jwt.verify(token, config.jwtRefreshSecret);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

module.exports = { signAccess, verifyAccess, signRefresh, verifyRefresh, sha256 };
