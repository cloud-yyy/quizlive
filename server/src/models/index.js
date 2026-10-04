const sequelize = require('../db');
const User = require('./User');
const RefreshToken = require('./RefreshToken');
const Quiz = require('./Quiz');

User.hasMany(RefreshToken, { foreignKey: { name: 'userId', allowNull: false }, onDelete: 'CASCADE' });
RefreshToken.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Quiz, { foreignKey: { name: 'ownerId', allowNull: false }, as: 'quizzes', onDelete: 'CASCADE' });
Quiz.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

module.exports = { sequelize, User, RefreshToken, Quiz };
