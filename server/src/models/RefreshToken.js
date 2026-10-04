const { DataTypes } = require('sequelize');
const sequelize = require('../db');

// Only the SHA-256 hash of a refresh token is stored, never the token itself.
const RefreshToken = sequelize.define(
  'RefreshToken',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
  },
  { tableName: 'refresh_tokens', updatedAt: false },
);

module.exports = RefreshToken;
