const crypto = require('crypto');
const { Op, fn, col, literal } = require('sequelize');
const { Quiz, User, Question, Option } = require('../models');
const { notFound, forbidden, badRequest } = require('../utils/AppError');
const { security } = require('../utils/logger');
const { isStaff } = require('../middleware/auth');

const ownerInclude = { model: User, as: 'owner', attributes: ['id', 'nickname'] };
const questionCount = [literal('(SELECT COUNT(*)::int FROM questions q WHERE q."quizId" = "Quiz"."id")'), 'questionCount'];

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

const escapeLike = (s) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

async function findVisible(req, { withQuestions = false } = {}) {
  const quiz = await Quiz.findByPk(req.valid.params.id, {
    attributes: { include: [questionCount] },
    include: [
      ownerInclude,
      ...(withQuestions
        ? [{ model: Question, as: 'questions', include: [{ model: Option, as: 'options' }] }]
        : []),
    ],
    order: withQuestions
      ? [[{ model: Question, as: 'questions' }, 'position', 'ASC'], [{ model: Question, as: 'questions' }, 'id', 'ASC'], [{ model: Question, as: 'questions' }, { model: Option, as: 'options' }, 'position', 'ASC']]
      : undefined,
  });
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

/** A quiz can be published only if it has at least one question (questions are validated on write). */
async function assertPublishable(quizId) {
  if ((await Question.count({ where: { quizId } })) < 1) {
    throw badRequest('A quiz needs at least one question before it can be published', [
      { field: 'status', message: 'add at least one question first' },
    ]);
  }
}

async function list(req, res) {
  const { page, limit, q, category, difficulty, status, mine, sort } = req.valid.query;
  const and = [];

  const visible = [{ status: 'published', isPublic: true }];
  if (req.user) visible.push(isStaff(req.user) ? {} : { ownerId: req.user.id });
  and.push({ [Op.or]: visible });

  if (mine) {
    if (!req.user) throw forbidden('Sign in to see your quizzes');
    and.push({ ownerId: req.user.id });
  }
  if (status) and.push({ status });
  if (category) and.push({ category: { [Op.iLike]: escapeLike(category) } });
  if (difficulty) and.push({ difficulty });
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    and.push({ [Op.or]: [{ title: { [Op.iLike]: pattern } }, { description: { [Op.iLike]: pattern } }] });
  }

  const order = {
    newest: [['createdAt', 'DESC'], ['id', 'DESC']],
    oldest: [['createdAt', 'ASC'], ['id', 'ASC']],
    title: [['title', 'ASC']],
    questions: [[literal('"questionCount"'), 'DESC'], ['id', 'DESC']],
  }[sort];

  const { rows, count } = await Quiz.findAndCountAll({
    where: { [Op.and]: and },
    attributes: { include: [questionCount] },
    include: [ownerInclude],
    order,
    limit,
    offset: (page - 1) * limit,
    distinct: true,
  });
  res.json({ items: rows, total: count, page, limit });
}

/** Public aggregate statistics of the published library. */
async function stats(req, res) {
  const where = { status: 'published', isPublic: true };
  const [total, byCategory, byDifficulty, totalQuestions] = await Promise.all([
    Quiz.count({ where }),
    Quiz.findAll({ where, attributes: ['category', [fn('COUNT', col('id')), 'count']], group: ['category'], order: [[literal('count'), 'DESC'], ['category', 'ASC']], raw: true }),
    Quiz.findAll({ where, attributes: ['difficulty', [fn('COUNT', col('id')), 'count']], group: ['difficulty'], raw: true }),
    Question.count({ include: [{ model: Quiz, attributes: [], where }] }),
  ]);
  res.json({
    total,
    totalQuestions,
    byCategory: byCategory.map((r) => ({ category: r.category, count: Number(r.count) })),
    byDifficulty: byDifficulty.map((r) => ({ difficulty: r.difficulty, count: Number(r.count) })),
  });
}

async function categories(req, res) {
  const rows = await Quiz.findAll({ where: { status: 'published', isPublic: true }, attributes: [[fn('DISTINCT', col('category')), 'category']], order: [['category', 'ASC']], raw: true });
  res.json({ items: rows.map((r) => r.category) });
}

async function get(req, res) {
  const quiz = await findVisible(req, { withQuestions: true });
  const json = quiz.toJSON();
  // Correct answers are visible only to the people who manage the quiz.
  if (!canManage(quiz, req.user) && !isStaff(req.user)) {
    for (const question of json.questions) for (const option of question.options) delete option.isCorrect;
  }
  res.json({ quiz: json });
}

async function create(req, res) {
  const body = req.valid.body;
  if (body.status === 'published') throw badRequest('Add questions first, then publish the quiz', [{ field: 'status', message: 'a new quiz has no questions yet' }]);
  const quiz = await Quiz.create({ ...body, slug: body.slug || makeSlug(body.title), ownerId: req.user.id });
  res.status(201).json({ quiz: await Quiz.findByPk(quiz.id, { attributes: { include: [questionCount] }, include: [ownerInclude] }) });
}

async function update(req, res) {
  const quiz = await findManageable(req);
  const body = req.valid.body;
  if (body.status === 'published' && quiz.status !== 'published') await assertPublishable(quiz.id);
  if (quiz.status === 'hidden' && body.status) {
    security('hidden_quiz_status_change', req, { quizId: quiz.id });
    throw forbidden('A hidden quiz can only be restored by a moderator');
  }
  await quiz.update(body);
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
  if (req.valid.body.status === 'published') await assertPublishable(quiz.id);
  quiz.status = req.valid.body.status;
  await quiz.save();
  security('quiz_moderated', req, { quizId: quiz.id, status: quiz.status });
  res.json({ quiz });
}

module.exports = { list, stats, categories, get, create, update, remove, moderate, canSee, canManage, findVisible, findManageable, assertPublishable };
