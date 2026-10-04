const config = require('../config');
const { logger } = require('../utils/logger');

function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'not_found', message: `Route ${req.method} ${req.path} not found` } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let code = err.code && typeof err.code === 'string' && err.expose ? err.code : undefined;
  let message = err.message;
  let details = err.details;

  if (err.name === 'SequelizeUniqueConstraintError') {
    status = 409;
    code = 'conflict';
    message = 'Resource already exists';
    details = err.errors.map((e) => ({ field: e.path, message: `${e.path} must be unique` }));
  } else if (err.name === 'SequelizeValidationError') {
    status = 400;
    code = 'validation_error';
    message = 'Validation failed';
    details = err.errors.map((e) => ({ field: e.path, message: e.message }));
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'bad_request';
    message = 'Malformed JSON body';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    code = 'payload_too_large';
    message = 'Request body too large';
  }

  if (status >= 500) {
    logger.error(err.message, { stack: err.stack, path: req.originalUrl, method: req.method });
    // Generic errors in production: never leak implementation details.
    if (config.isProd) message = 'Internal server error';
    code = code || 'internal_error';
    if (config.isProd) details = undefined;
    else details = details || err.stack;
  }

  res.status(status).json({ error: { code: code || 'error', message, ...(details ? { details } : {}) } });
}

module.exports = { notFoundHandler, errorHandler };
