const { User } = require('../models');
const { notFound, forbidden } = require('../utils/AppError');
const { security, logger } = require('../utils/logger');

async function list(req, res) {
  const { page, limit } = req.valid.query;
  const { rows, count } = await User.findAndCountAll({
    order: [['id', 'ASC']],
    limit,
    offset: (page - 1) * limit,
  });
  res.json({ items: rows.map((u) => u.toPublic()), total: count, page, limit });
}

async function getTarget(req) {
  const user = await User.findByPk(req.valid.params.id);
  if (!user) throw notFound('User not found');
  return user;
}

async function setRole(req, res) {
  const user = await getTarget(req);
  if (user.id === req.user.id) throw forbidden('You cannot change your own role');
  user.role = req.valid.body.role;
  await user.save();
  security('role_changed', req, { targetId: user.id, role: user.role });
  res.json({ user: user.toPublic() });
}

async function setBlocked(req, res) {
  const user = await getTarget(req);
  if (user.id === req.user.id) throw forbidden('You cannot block yourself');
  user.isBlocked = req.valid.body.isBlocked;
  await user.save();
  security('user_block_changed', req, { targetId: user.id, isBlocked: user.isBlocked });
  res.json({ user: user.toPublic() });
}

async function remove(req, res) {
  const user = await getTarget(req);
  if (user.id === req.user.id) throw forbidden('You cannot delete yourself');
  await user.destroy();
  logger.info('user deleted', { targetId: user.id, by: req.user.id });
  res.status(204).end();
}

module.exports = { list, setRole, setBlocked, remove };
