const { Sequelize } = require('sequelize');
const config = require('./config');

const sequelize = new Sequelize(config.databaseUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: config.databaseSsl ? { ssl: { require: true, rejectUnauthorized: false } } : {},
});

module.exports = sequelize;
