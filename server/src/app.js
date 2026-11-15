const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const config = require('./config');
const openapi = require('./docs/openapi');
const { globalLimiter } = require('./middleware/rateLimit');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { logger, security } = require('./utils/logger');
const { requestCounter } = require('./utils/metrics');

const app = express();

app.set('trust proxy', config.trustProxy);
app.disable('x-powered-by');

app.use(requestCounter);
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
    const started = Date.now();
    res.on('finish', () => {
      // 4xx (bad requests) are kept in production logs as warnings, 5xx as errors.
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'debug';
      logger.log(level, `${req.method} ${req.originalUrl} ${res.statusCode}`, {
        status: res.statusCode,
        durationMs: Date.now() - started,
        ip: req.ip,
      });
    });
    next();
  });
}

app.use(require('./routes/system'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'QuizLive API docs' }));
app.get('/openapi.json', (req, res) => res.json(openapi));
app.use('/auth', require('./routes/auth'));
app.use('/users', require('./routes/users'));
app.use('/quizzes', require('./routes/quizzes'));
app.use('/questions', require('./routes/questions'));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
