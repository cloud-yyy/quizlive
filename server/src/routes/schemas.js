const Joi = require('joi');
const { PASSWORD_RE } = require('../utils/password');
const { stripTags } = require('../utils/sanitize');
const { Quiz, User, Question } = require('../models');

const id = Joi.number().integer().positive().required();
const paging = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
};

// Free text: HTML tags are removed before length checks, so "<b></b>" cannot pass as a title.
const text = () => Joi.string().custom(stripTags).trim();

const email = Joi.string().trim().max(254).email({ tlds: { allow: false } }).required();

const option = Joi.object({
  text: text().min(1).max(200).required(),
  isCorrect: Joi.boolean().default(false),
});
const questionBase = {
  text: text().min(3).max(300),
  type: Joi.string().valid(...Question.TYPES),
  timeLimitSec: Joi.number().integer().min(5).max(120),
  points: Joi.number().integer().min(100).max(5000),
  position: Joi.number().integer().min(0),
  options: Joi.array().items(option).min(2).max(6),
};

module.exports = {
  idParams: Joi.object({ id }),
  paging: Joi.object(paging),
  auth: {
    register: Joi.object({
      email,
      password: Joi.string()
        .pattern(PASSWORD_RE)
        .required()
        .messages({ 'string.pattern.base': 'password must be 8-72 chars and contain a letter, a digit and a special character' }),
      nickname: text().min(2).max(30),
    }),
    login: Joi.object({ email, password: Joi.string().max(72).required() }),
  },
  users: {
    role: Joi.object({ role: Joi.string().valid(...User.ROLES).required() }),
    block: Joi.object({ isBlocked: Joi.boolean().required() }),
  },
  questions: {
    create: Joi.object({ ...questionBase, text: questionBase.text.required(), options: questionBase.options.required() }),
    update: Joi.object(questionBase).min(1),
  },
  quizzes: {
    listQuery: Joi.object({
      ...paging,
      q: Joi.string().trim().max(100),
      category: Joi.string().trim().max(40),
      difficulty: Joi.string().valid(...Quiz.DIFFICULTIES),
      status: Joi.string().valid(...Quiz.STATUSES),
      mine: Joi.boolean(),
      sort: Joi.string().valid('newest', 'oldest', 'title', 'questions').default('newest'),
    }),
    create: Joi.object({
      title: text().min(3).max(120).required(),
      slug: Joi.string().pattern(/^[a-z0-9-]+$/).min(3).max(100),
      description: text().allow('').max(1000),
      category: text().min(2).max(40),
      difficulty: Joi.string().valid(...Quiz.DIFFICULTIES),
      isPublic: Joi.boolean(),
      status: Joi.string().valid('draft', 'published'),
    }),
    update: Joi.object({
      title: text().min(3).max(120),
      description: text().allow('').max(1000),
      category: text().min(2).max(40),
      difficulty: Joi.string().valid(...Quiz.DIFFICULTIES),
      isPublic: Joi.boolean(),
      status: Joi.string().valid('draft', 'published'),
    }).min(1),
    moderation: Joi.object({ status: Joi.string().valid('published', 'hidden').required() }),
  },
};
