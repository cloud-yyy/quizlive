const { Question, Option, Quiz, sequelize } = require('../models');
const { notFound, conflict, forbidden } = require('../utils/AppError');
const { assertOptionsValid } = require('../utils/questionRules');
const { security } = require('../utils/logger');
const { canManage, canSee } = require('./quizController');

const withOptions = { model: Option, as: 'options' };
const orderBy = [['position', 'ASC'], ['id', 'ASC'], [{ model: Option, as: 'options' }, 'position', 'ASC']];

async function loadQuizForOwner(req, quizId) {
  const quiz = await Quiz.findByPk(quizId);
  if (!quiz || !canSee(quiz, req.user)) throw notFound('Quiz not found');
  if (!canManage(quiz, req.user)) {
    security('foreign_resource_modify', req, { quizId });
    throw forbidden('Only the owner or an admin can modify this quiz');
  }
  return quiz;
}

async function loadQuestionForOwner(req) {
  const question = await Question.findByPk(req.valid.params.id, { include: [withOptions], order: orderBy });
  if (!question) throw notFound('Question not found');
  const quiz = await loadQuizForOwner(req, question.quizId);
  return { question, quiz };
}

const toOptionRows = (options) => options.map((o, i) => ({ text: o.text.trim(), isCorrect: !!o.isCorrect, position: i }));

async function list(req, res) {
  const quiz = await loadQuizForOwner(req, req.valid.params.id);
  const questions = await Question.findAll({ where: { quizId: quiz.id }, include: [withOptions], order: orderBy });
  res.json({ items: questions });
}

async function create(req, res) {
  const quiz = await loadQuizForOwner(req, req.valid.params.id);
  const { options, ...data } = req.valid.body;
  assertOptionsValid(data.type || 'single', options);
  const id = await sequelize.transaction(async (transaction) => {
    if (data.position === undefined) data.position = await Question.count({ where: { quizId: quiz.id }, transaction });
    const question = await Question.create({ ...data, quizId: quiz.id }, { transaction });
    await Option.bulkCreate(toOptionRows(options).map((o) => ({ ...o, questionId: question.id })), { transaction });
    return question.id;
  });
  res.status(201).json({ question: await Question.findByPk(id, { include: [withOptions], order: orderBy }) });
}

async function update(req, res) {
  const { question } = await loadQuestionForOwner(req);
  const { options, ...data } = req.valid.body;
  const type = data.type || question.type;
  if (options) assertOptionsValid(type, options);
  else if (data.type) assertOptionsValid(type, question.options);
  await sequelize.transaction(async (transaction) => {
    await question.update(data, { transaction });
    if (options) {
      await Option.destroy({ where: { questionId: question.id }, transaction });
      await Option.bulkCreate(toOptionRows(options).map((o) => ({ ...o, questionId: question.id })), { transaction });
    }
  });
  res.json({ question: await Question.findByPk(question.id, { include: [withOptions], order: orderBy }) });
}

async function remove(req, res) {
  const { question, quiz } = await loadQuestionForOwner(req);
  if (quiz.status === 'published' && (await Question.count({ where: { quizId: quiz.id } })) <= 1) {
    throw conflict('A published quiz must keep at least one question; unpublish it first');
  }
  await question.destroy();
  res.status(204).end();
}

module.exports = { list, create, update, remove };
