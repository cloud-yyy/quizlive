const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const TYPES = ['single', 'multiple', 'truefalse'];

const Question = sequelize.define(
  'Question',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    text: { type: DataTypes.STRING(300), allowNull: false, validate: { len: [3, 300] } },
    type: { type: DataTypes.ENUM(...TYPES), allowNull: false, defaultValue: 'single' },
    timeLimitSec: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 20, validate: { min: 5, max: 120 } },
    points: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1000, validate: { min: 100, max: 5000 } },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { tableName: 'questions' },
);

Question.TYPES = TYPES;
module.exports = Question;
