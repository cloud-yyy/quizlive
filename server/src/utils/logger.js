const path = require('path');
const winston = require('winston');
const config = require('../config');

const { combine, timestamp, json, colorize, printf } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ level, message, timestamp: ts, ...meta }) => {
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} ${level}: ${message}${rest}`;
  }),
);

function build(name) {
  const transports = [
    new winston.transports.Console({
      silent: config.isTest,
      format: config.isProd ? combine(timestamp(), json()) : devFormat,
    }),
  ];
  if (!config.isTest) {
    transports.push(
      new winston.transports.File({
        filename: path.join(config.logDir, `${name}.log`),
        format: combine(timestamp(), json()),
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5,
        tailable: true,
      }),
    );
  }
  return winston.createLogger({ level: config.isProd ? 'info' : 'debug', transports });
}

const logger = build('app');
const securityLogger = build('security');

/**
 * Logs a suspicious / security-relevant event (failed login, forbidden access,
 * mass assignment attempt, token reuse ...) with request context.
 */
function security(event, req, meta = {}) {
  securityLogger.warn(event, {
    event,
    ip: req && (req.ip || req.socket?.remoteAddress),
    userAgent: req && req.get && req.get('user-agent'),
    method: req && req.method,
    path: req && req.originalUrl,
    userId: req && req.user ? req.user.id : undefined,
    ...meta,
  });
}

module.exports = { logger, security };
