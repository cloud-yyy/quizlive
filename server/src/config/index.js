require('dotenv').config();

const env = process.env;
const nodeEnv = env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

if (isProd && (!env.JWT_SECRET || !env.JWT_REFRESH_SECRET)) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set in production');
}

module.exports = {
  nodeEnv,
  isProd,
  isTest: nodeEnv === 'test',
  port: Number(env.PORT) || 4000,
  databaseUrl: env.DATABASE_URL || 'postgres://quiz:quiz@localhost:5433/quizlive',
  databaseSsl: env.DATABASE_SSL === 'true',
  jwtSecret: env.JWT_SECRET || 'dev-access-secret-change-me',
  jwtRefreshSecret: env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
  accessTtl: env.ACCESS_TOKEN_TTL || '15m',
  refreshTtlDays: Number(env.REFRESH_TOKEN_TTL_DAYS) || 7,
  corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8080')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  cookie: {
    sameSite: env.COOKIE_SAMESITE || 'lax',
    secure: env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProd,
  },
  rateLimit: {
    windowMs: Number(env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(env.RATE_LIMIT_MAX) || 300,
    authMax: Number(env.RATE_LIMIT_AUTH_MAX) || 30,
  },
  lock: {
    maxAttempts: Number(env.LOGIN_MAX_ATTEMPTS) || 5,
    minutes: Number(env.LOGIN_LOCK_MINUTES) || 15,
  },
  admin: {
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
  },
  logDir: env.LOG_DIR || 'logs',
  bodyLimit: env.BODY_LIMIT || '100kb',
};
