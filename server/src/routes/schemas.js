const Joi = require('joi');
const { PASSWORD_RE } = require('../utils/password');
const { Quiz, User } = require('../models');

const id = Joi.number().integer().positive().required();
const paging = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
};

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
      nickname: Joi.string().trim().min(2).max(30),
    }),
    login: Joi.object({ email, password: Joi.string().max(72).required() }),
  },
  users: {
    role: Joi.object({ role: Joi.string().valid(...User.ROLES).required() }),
    block: Joi.object({ isBlocked: Joi.boolean().required() }),
  },
  quizzes: {
    create: Joi.object({
      title: Joi.string().trim().min(3).max(120).required(),
      slug: Joi.string().pattern(/^[a-z0-9-]+$/).min(3).max(100),
      description: Joi.string().trim().allow('').max(1000),
      category: Joi.string().trim().min(2).max(40),
      difficulty: Joi.string().valid(...Quiz.DIFFICULTIES),
      isPublic: Joi.boolean(),
      status: Joi.string().valid('draft', 'published'),
    }),
    update: Joi.object({
      title: Joi.string().trim().min(3).max(120),
      description: Joi.string().trim().allow('').max(1000),
      category: Joi.string().trim().min(2).max(40),
      difficulty: Joi.string().valid(...Quiz.DIFFICULTIES),
      isPublic: Joi.boolean(),
      status: Joi.string().valid('draft', 'published'),
    }).min(1),
    moderation: Joi.object({ status: Joi.string().valid('published', 'hidden').required() }),
  },
};
