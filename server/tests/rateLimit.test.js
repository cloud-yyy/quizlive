const request = require('supertest');

describe('rate limiting', () => {
  it('returns 429 once the auth limit is exceeded', async () => {
    process.env.RATE_LIMIT_AUTH_MAX = '3';
    let app;
    jest.isolateModules(() => {
      app = require('../src/app');
    });
    const body = { email: 'nobody@test.local', password: 'Wrong#Pass1' };
    const statuses = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await request(app).post('/auth/login').send(body)).status);
    expect(statuses.slice(0, 3).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(3)).toEqual([429, 429]);
    process.env.RATE_LIMIT_AUTH_MAX = '100000';
  });
});
