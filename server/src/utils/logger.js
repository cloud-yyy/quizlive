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

/**
 * Optional log shipping to Grafana Loki (self-hosted on the same VPS).
 * Enabled only when LOKI_URL is set, so local runs and tests need no Loki.
 */
function lokiTransport(name) {
  if (!process.env.LOKI_URL || config.isTest) return null;
  const LokiTransport = require('winston-loki');
  return new LokiTransport({
    host: process.env.LOKI_URL,
    labels: { app: 'quizlive', env: config.nodeEnv, stream: name },
    json: true,
    format: combine(timestamp(), json()),
    batching: true,
    interval: 5,
    replaceTimestamp: true,
    onConnectionError: (err) => console.error('Loki connection error:', err && err.message), // eslint-disable-line no-console
  });
}

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
  const loki = lokiTransport(name);
  if (loki) transports.push(loki);
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
