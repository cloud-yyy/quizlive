const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { globalLimiter } = require('./middleware/rateLimit');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { logger, security } = require('./utils/logger');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // Non-browser clients (curl, Postman, server-to-server) send no Origin header.
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      security('cors_rejected', null, { origin });
      return cb(null, false);
    },
    credentials: true,
  }),
);
app.use(globalLimiter);
app.use(express.json({ limit: config.bodyLimit, type: 'application/json' }));
app.use(cookieParser());

if (!config.isTest) {
  app.use((req, res, next) => {
    res.on('finish', () => logger.debug(`${req.method} ${req.originalUrl} ${res.statusCode}`));
    next();
  });
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/auth', require('./routes/auth'));
app.use('/users', require('./routes/users'));
app.use('/quizzes', require('./routes/quizzes'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
