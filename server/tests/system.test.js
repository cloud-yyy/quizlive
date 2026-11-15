const { app, request, resetDb, actor, sequelize } = require('./helpers');

beforeAll(resetDb);
afterAll(() => sequelize.close());

describe('health & metrics (monitoring endpoints)', () => {
  it('/health reports API and database status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  });

  it('/metrics returns uptime, memory and a growing request counter', async () => {
    const a = await request(app).get('/metrics');
    expect(a.status).toBe(200);
    expect(a.body.uptimeSec).toBeGreaterThanOrEqual(0);
    expect(a.body.memory.rssMb).toBeGreaterThan(0);
    await request(app).get('/nope');
    const b = await request(app).get('/metrics');
    expect(b.body.requests.total).toBeGreaterThan(a.body.requests.total);
    expect(b.body.requests.byStatus['4xx']).toBeGreaterThanOrEqual(1);
  });

  it('/status serves the HTML dashboard', async () => {
    const res = await request(app).get('/status');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('metrics');
  });

  it('/debug/error is admin-only and produces a 500 with a generic JSON error', async () => {
    const user = await actor('user');
    const admin = await actor('admin');
    expect((await request(app).get('/debug/error')).status).toBe(401);
    expect((await request(app).get('/debug/error').set('Authorization', user.bearer)).status).toBe(403);
    const res = await request(app).get('/debug/error').set('Authorization', admin.bearer);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('internal_error');
  });
});
