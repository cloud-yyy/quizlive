const Joi = require('joi');
const { PASSWORD_RE } = require('../utils/password');
const { stripTags } = require('../utils/sanitize');
const { Quiz, User } = require('../models');

const id = Joi.number().integer().positive().required();
const paging = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
};

// Free text: HTML tags are removed before length checks, so "<b></b>" cannot pass as a title.
const text = () => Joi.string().custom(stripTags).trim();

const email = Joi.string().trim().max(254).email({ tlds: { allow: false } }).required();

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
  quizzes: {
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
