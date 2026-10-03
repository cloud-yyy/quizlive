const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const { seedAdmin } = require('./seed');
const { logger } = require('./utils/logger');

async function start() {
  await sequelize.authenticate();
  await sequelize.sync();
  await seedAdmin();

  const server = http.createServer(app);
  server.listen(config.port, () => logger.info(`QuizLive API listening on :${config.port} (${config.nodeEnv})`));

  const shutdown = () => {
    server.close(() => sequelize.close().then(() => process.exit(0)));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  logger.error('Failed to start', { error: err.message, stack: err.stack });
  process.exit(1);
});
