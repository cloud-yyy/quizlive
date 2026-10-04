const { User } = require('../models');
const { verifyAccess } = require('../utils/tokens');
const { unauthorized, forbidden, AppError } = require('../utils/AppError');
const { security } = require('../utils/logger');

const ROLE_RANK = { user: 1, moderator: 2, admin: 3 };

async function loadUser(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  let payload;
  try {
    payload = verifyAccess(token);
  } catch (e) {
    throw unauthorized('Invalid or expired token');
  }
  const user = await User.findByPk(payload.id);
  if (!user) throw unauthorized('User no longer exists');
  if (user.isBlocked) throw new AppError(403, 'account_blocked', 'Account is blocked');
  return user;
}

/** Requires a valid access token. */
async function authenticate(req, res, next) {
  try {
    const user = await loadUser(req);
    if (!user) {
      security('missing_token', req);
      throw unauthorized();
    }
    req.user = user;
    next();
  } catch (e) {
    if (e.status === 401 && e.message !== 'Authentication required') security('invalid_token', req);
    next(e);
  }
}

/** Attaches req.user when a valid token is present, otherwise continues anonymously. */
async function optionalAuth(req, res, next) {
  try {
    req.user = (await loadUser(req)) || undefined;
    next();
  } catch (e) {
    next(e);
  }
}

/** roleGuard('moderator') lets moderators and admins through (role hierarchy). */
function roleGuard(requiredRole) {
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if ((ROLE_RANK[req.user.role] || 0) < ROLE_RANK[requiredRole]) {
      security('forbidden_role', req, { required: requiredRole, actual: req.user.role });
      return next(forbidden(`Requires role: ${requiredRole}`));
    }
    return next();
  };
}

const isStaff = (user) => !!user && (user.role === 'moderator' || user.role === 'admin');

module.exports = { authenticate, optionalAuth, roleGuard, isStaff, ROLE_RANK };
