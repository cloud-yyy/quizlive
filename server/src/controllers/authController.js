const config = require('../config');
const { User, RefreshToken } = require('../models');
const password = require('../utils/password');
const tokens = require('../utils/tokens');
const { AppError, unauthorized, conflict } = require('../utils/AppError');
const { security, logger } = require('../utils/logger');

const REFRESH_COOKIE = 'refreshToken';

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.cookie.secure,
  sameSite: config.cookie.sameSite,
  path: '/',
  maxAge: config.refreshTtlDays * 24 * 60 * 60 * 1000,
});

async function issueSession(user, res) {
  const refresh = tokens.signRefresh(user);
  await RefreshToken.create({
    userId: user.id,
    tokenHash: tokens.sha256(refresh),
    expiresAt: new Date(Date.now() + config.refreshTtlDays * 24 * 60 * 60 * 1000),
  });
  res.cookie(REFRESH_COOKIE, refresh, cookieOptions());
  return tokens.signAccess(user);
}

async function register(req, res) {
  const { email, password: plain, nickname } = req.valid.body;
  const normalized = email.toLowerCase();
  if (await User.findOne({ where: { email: normalized } })) throw conflict('E-mail is already registered');
  // role is never taken from the request: new accounts are always "user".
  const user = await User.create({
    email: normalized,
    passwordHash: await password.hash(plain),
    nickname: nickname || normalized.split('@')[0].slice(0, 30),
  });
  logger.info('user registered', { userId: user.id });
  res.status(201).json({ user: user.toPublic() });
}

async function login(req, res) {
  const { email, password: plain } = req.valid.body;
  const user = await User.findOne({ where: { email: email.toLowerCase() } });

  if (user && user.lockUntil && user.lockUntil > new Date()) {
    security('login_while_locked', req, { userId: user.id });
    const retryAfterSec = Math.ceil((user.lockUntil - Date.now()) / 1000);
    res.set('Retry-After', String(retryAfterSec));
    throw new AppError(423, 'account_locked', `Too many failed attempts. Try again in ${Math.ceil(retryAfterSec / 60)} min`, { retryAfterSec });
  }

  // Always run bcrypt (dummy hash for unknown users) to avoid timing leaks.
  const ok = await password.compare(plain, user && user.passwordHash);
  if (!user || !ok) {
    if (user) {
      user.failedAttempts += 1;
      if (user.failedAttempts >= config.lock.maxAttempts) {
        user.lockUntil = new Date(Date.now() + config.lock.minutes * 60 * 1000);
        user.failedAttempts = 0;
        security('account_locked', req, { userId: user.id, minutes: config.lock.minutes });
      }
      await user.save();
    }
    security('login_failed', req, { email: email.toLowerCase(), known: !!user });
    throw unauthorized('Invalid e-mail or password');
  }

  if (user.isBlocked) {
    security('login_blocked_user', req, { userId: user.id });
    throw new AppError(403, 'account_blocked', 'Account is blocked');
  }

  user.failedAttempts = 0;
  user.lockUntil = null;
  await user.save();
  const accessToken = await issueSession(user, res);
  res.json({ accessToken, user: user.toPublic() });
}

async function refresh(req, res) {
  const token = req.cookies && req.cookies[REFRESH_COOKIE];
  if (!token) throw unauthorized('Refresh token missing');
  let payload;
  try {
    payload = tokens.verifyRefresh(token);
  } catch (e) {
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
    throw unauthorized('Invalid refresh token');
  }
  const stored = await RefreshToken.findOne({ where: { tokenHash: tokens.sha256(token) } });
  if (!stored || stored.expiresAt < new Date()) {
    // A cryptographically valid token that is no longer stored was already used: possible theft.
    if (!stored) {
      security('refresh_token_reuse', req, { userId: payload.id });
      await RefreshToken.destroy({ where: { userId: payload.id } });
    }
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
    throw unauthorized('Refresh token expired or revoked');
  }
  const user = await User.findByPk(payload.id);
  if (!user || user.isBlocked) {
    await stored.destroy();
    throw unauthorized('Account unavailable');
  }
  await stored.destroy(); // rotation
  const accessToken = await issueSession(user, res);
  res.json({ accessToken, user: user.toPublic() });
}

async function logout(req, res) {
  const token = req.cookies && req.cookies[REFRESH_COOKIE];
  if (token) await RefreshToken.destroy({ where: { tokenHash: tokens.sha256(token) } });
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
}

function me(req, res) {
  res.json({ user: req.user.toPublic() });
}

module.exports = { register, login, refresh, logout, me };
