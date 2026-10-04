const { app, request, resetDb, createUser, login, PASSWORD, sequelize } = require('./helpers');
const { RefreshToken } = require('../src/models');

beforeAll(resetDb);
afterAll(() => sequelize.close());

describe('POST /auth/register', () => {
  it('registers a user with role "user" and never returns the hash', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'New@Test.local', password: PASSWORD, nickname: 'neo' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'new@test.local', role: 'user', nickname: 'neo' });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects mass assignment of role (400)', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'evil@test.local', password: PASSWORD, role: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it.each([
    ['short', 'a1!'],
    ['no digit', 'Password!!'],
    ['no special char', 'Password11'],
  ])('rejects weak password: %s', async (_name, pwd) => {
    const res = await request(app).post('/auth/register').send({ email: 'weak@test.local', password: pwd });
    expect(res.status).toBe(400);
  });

  it('rejects invalid e-mail and duplicates', async () => {
    expect((await request(app).post('/auth/register').send({ email: 'nope', password: PASSWORD })).status).toBe(400);
    const dup = await request(app).post('/auth/register').send({ email: 'new@test.local', password: PASSWORD });
    expect(dup.status).toBe(409);
  });
});

describe('login / me / refresh / logout', () => {
  it('issues access token + httpOnly refresh cookie, and /auth/me works', async () => {
    const user = await createUser();
    const { token, cookies, res } = await login(user);
    expect(res.status).toBe(200);
    expect(cookies.join(';')).toMatch(/refreshToken=.*HttpOnly/i);
    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(user.email);
  });

  it('returns 401 without or with a bad token', async () => {
    expect((await request(app).get('/auth/me')).status).toBe(401);
    expect((await request(app).get('/auth/me').set('Authorization', 'Bearer garbage')).status).toBe(401);
  });

  it('rotates the refresh token and detects reuse', async () => {
    const user = await createUser();
    const { cookies } = await login(user);
    const first = await request(app).post('/auth/refresh').set('Cookie', cookies);
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toBeTruthy();
    const newCookies = first.headers['set-cookie'];
    // old token was rotated -> reuse must fail and revoke every session of the user
    const reuse = await request(app).post('/auth/refresh').set('Cookie', cookies);
    expect(reuse.status).toBe(401);
    const afterRevoke = await request(app).post('/auth/refresh').set('Cookie', newCookies);
    expect(afterRevoke.status).toBe(401);
  });

  it('logout revokes the refresh token', async () => {
    const user = await createUser();
    const { cookies } = await login(user);
    expect((await request(app).post('/auth/logout').set('Cookie', cookies)).status).toBe(204);
    expect((await request(app).post('/auth/refresh').set('Cookie', cookies)).status).toBe(401);
    expect(await RefreshToken.count({ where: { userId: user.id } })).toBe(0);
  });

  it('locks the account after 5 failed attempts, even for the right password', async () => {
    const user = await createUser();
    for (let i = 0; i < 5; i += 1) {
      const r = await request(app).post('/auth/login').send({ email: user.email, password: 'Wrong#Pass1' });
      expect(r.status).toBe(401);
    }
    const locked = await request(app).post('/auth/login').send({ email: user.email, password: PASSWORD });
    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe('account_locked');
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('does not reveal whether an e-mail exists', async () => {
    const a = await request(app).post('/auth/login').send({ email: 'ghost@test.local', password: 'Wrong#Pass1' });
    const user = await createUser();
    const b = await request(app).post('/auth/login').send({ email: user.email, password: 'Wrong#Pass1' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it('blocked users cannot log in or use an existing token', async () => {
    const user = await createUser();
    const { token } = await login(user);
    await user.update({ isBlocked: true });
    expect((await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`)).status).toBe(403);
    expect((await request(app).post('/auth/login').send({ email: user.email, password: PASSWORD })).status).toBe(403);
  });
});

describe('platform hardening', () => {
  it('sets security headers (helmet) and hides x-powered-by', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('CORS: allows white-listed origins only', async () => {
    const ok = await request(app).get('/health').set('Origin', 'http://localhost:8080');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:8080');
    const bad = await request(app).get('/health').set('Origin', 'http://evil.example');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns JSON 404 and 400 for malformed JSON', async () => {
    expect((await request(app).get('/nope')).status).toBe(404);
    const bad = await request(app).post('/auth/login').set('Content-Type', 'application/json').send('{oops');
    expect(bad.status).toBe(400);
  });

  it('rejects oversized bodies (413)', async () => {
    const big = { email: 'a@b.co', password: 'x'.repeat(200 * 1024) };
    expect((await request(app).post('/auth/login').send(big)).status).toBe(413);
  });
});
