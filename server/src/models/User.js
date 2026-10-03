const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const ROLES = ['user', 'moderator', 'admin'];

const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    email: { type: DataTypes.STRING(254), allowNull: false, unique: true, validate: { isEmail: true } },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    nickname: { type: DataTypes.STRING(30), allowNull: false },
    role: { type: DataTypes.ENUM(...ROLES), allowNull: false, defaultValue: 'user' },
    isBlocked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    failedAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lockUntil: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: 'users' },
);

User.prototype.toPublic = function toPublic() {
  const { id, email, nickname, role, isBlocked, createdAt, updatedAt } = this;
  return { id, email, nickname, role, isBlocked, createdAt, updatedAt };
};

User.ROLES = ROLES;
module.exports = User;
