const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const STATUSES = ['draft', 'published', 'hidden'];

const Quiz = sequelize.define(
  'Quiz',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    title: { type: DataTypes.STRING(120), allowNull: false, validate: { len: [3, 120] } },
    slug: { type: DataTypes.STRING(100), allowNull: false, unique: true, validate: { is: /^[a-z0-9-]+$/ } },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    category: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'general' },
    difficulty: { type: DataTypes.ENUM(...DIFFICULTIES), allowNull: false, defaultValue: 'medium' },
    isPublic: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    status: { type: DataTypes.ENUM(...STATUSES), allowNull: false, defaultValue: 'draft' },
  },
  { tableName: 'quizzes' },
);

Quiz.DIFFICULTIES = DIFFICULTIES;
Quiz.STATUSES = STATUSES;
module.exports = Quiz;
