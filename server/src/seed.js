const config = require('./config');
const { User } = require('./models');
const password = require('./utils/password');
const { logger } = require('./utils/logger');

/** Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD if it does not exist yet. */
async function seedAdmin() {
  const { email, password: plain } = config.admin;
  if (!email || !plain) return null;
  const [user, created] = await User.findOrCreate({
    where: { email: email.toLowerCase() },
    defaults: { passwordHash: await password.hash(plain), nickname: 'admin', role: 'admin' },
  });
  if (created) logger.info('admin account created', { email });
  return user;
}

module.exports = { seedAdmin };
