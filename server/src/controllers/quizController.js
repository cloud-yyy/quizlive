const crypto = require('crypto');
const { Op } = require('sequelize');
const { Quiz, User } = require('../models');
const { notFound, forbidden } = require('../utils/AppError');
const { security } = require('../utils/logger');
const { isStaff } = require('../middleware/auth');

const ownerInclude = { model: User, as: 'owner', attributes: ['id', 'nickname'] };

function makeSlug(title) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'quiz'}-${crypto.randomBytes(3).toString('hex')}`;
}

const canSee = (quiz, user) =>
  (quiz.status === 'published' && quiz.isPublic) || (user && (quiz.ownerId === user.id || isStaff(user)));

const canManage = (quiz, user) => user && (quiz.ownerId === user.id || user.role === 'admin');

async function findVisible(req) {
  const quiz = await Quiz.findByPk(req.valid.params.id, { include: [ownerInclude] });
  if (!quiz || !canSee(quiz, req.user)) {
    if (quiz) security('foreign_resource_access', req, { quizId: quiz.id });
    throw notFound('Quiz not found');
  }
  return quiz;
}

async function findManageable(req) {
  const quiz = await findVisible(req);
  if (!canManage(quiz, req.user)) {
    security('foreign_resource_modify', req, { quizId: quiz.id });
    throw forbidden('Only the owner or an admin can modify this quiz');
  }
  return quiz;
}

async function list(req, res) {
  const { page, limit } = req.valid.query;
  const visible = [{ status: 'published', isPublic: true }];
  if (req.user) {
    if (isStaff(req.user)) visible.push({}); // staff sees everything
    else visible.push({ ownerId: req.user.id });
  }
  const { rows, count } = await Quiz.findAndCountAll({
    where: { [Op.or]: visible },
    include: [ownerInclude],
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });
  res.json({ items: rows, total: count, page, limit });
}

async function get(req, res) {
  res.json({ quiz: await findVisible(req) });
}

async function create(req, res) {
  const body = req.valid.body;
  const quiz = await Quiz.create({ ...body, slug: body.slug || makeSlug(body.title), ownerId: req.user.id });
  res.status(201).json({ quiz: await Quiz.findByPk(quiz.id, { include: [ownerInclude] }) });
}

async function update(req, res) {
  const quiz = await findManageable(req);
  // A moderator's decision must not be undone by the owner re-publishing a hidden quiz.
  if (quiz.status === 'hidden' && 'status' in req.valid.body && !isStaff(req.user)) {
    security('hidden_quiz_status_change', req, { quizId: quiz.id });
    throw forbidden('This quiz was hidden by a moderator; its status cannot be changed');
  }
  await quiz.update(req.valid.body);
  res.json({ quiz });
}

async function remove(req, res) {
  const quiz = await findManageable(req);
  await quiz.destroy();
  res.status(204).end();
}

/** Moderators/admins can hide a public quiz or restore it. */
async function moderate(req, res) {
  const quiz = await Quiz.findByPk(req.valid.params.id, { include: [ownerInclude] });
  if (!quiz) throw notFound('Quiz not found');
  quiz.status = req.valid.body.status;
  await quiz.save();
  security('quiz_moderated', req, { quizId: quiz.id, status: quiz.status });
  res.json({ quiz });
}

module.exports = { list, get, create, update, remove, moderate, canSee, canManage, findVisible, findManageable };
