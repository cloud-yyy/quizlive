const sequelize = require('../db');
const User = require('./User');
const RefreshToken = require('./RefreshToken');
const Quiz = require('./Quiz');
const Question = require('./Question');
const Option = require('./Option');

User.hasMany(RefreshToken, { foreignKey: { name: 'userId', allowNull: false }, onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Quiz, { foreignKey: { name: 'ownerId', allowNull: false }, as: 'quizzes', onDelete: 'CASCADE' });
Quiz.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

Quiz.hasMany(Question, { foreignKey: { name: 'quizId', allowNull: false }, as: 'questions', onDelete: 'CASCADE' });
Question.belongsTo(Quiz, { foreignKey: 'quizId' });

Question.hasMany(Option, { foreignKey: { name: 'questionId', allowNull: false }, as: 'options', onDelete: 'CASCADE' });
Option.belongsTo(Question, { foreignKey: 'questionId' });

module.exports = { sequelize, User, RefreshToken, Quiz, Question, Option };
