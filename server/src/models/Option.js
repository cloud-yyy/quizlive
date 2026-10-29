const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const Option = sequelize.define(
  'Option',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    text: { type: DataTypes.STRING(200), allowNull: false },
    isCorrect: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { tableName: 'options', timestamps: false },
);

module.exports = Option;
