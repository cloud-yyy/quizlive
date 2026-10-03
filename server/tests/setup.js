process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://quiz:quiz@localhost:5433/quizlive_test';
process.env.RATE_LIMIT_MAX = '100000';
process.env.RATE_LIMIT_AUTH_MAX = '100000';
process.env.LOGIN_MAX_ATTEMPTS = '5';
