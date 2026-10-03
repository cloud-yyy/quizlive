const { app, request, resetDb, actor, createUser, sequelize } = require('./helpers');

beforeAll(resetDb);
afterAll(() => sequelize.close());

describe('admin user management (role guard)', () => {
  it('forbids a regular user and a moderator from /users (403), anonymous gets 401', async () => {
    const user = await actor('user');
    const mod = await actor('moderator');
    expect((await request(app).get('/users')).status).toBe(401);
    expect((await request(app).get('/users').set('Authorization', user.bearer)).status).toBe(403);
    expect((await request(app).get('/users').set('Authorization', mod.bearer)).status).toBe(403);
  });

  it('lets an admin list, change role, block and delete users', async () => {
    const admin = await actor('admin');
    const target = await createUser('user');
    const list = await request(app).get('/users?limit=100').set('Authorization', admin.bearer);
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBeGreaterThanOrEqual(2);
    expect(list.body.items[0].passwordHash).toBeUndefined();

    const role = await request(app).patch(`/users/${target.id}/role`).set('Authorization', admin.bearer).send({ role: 'moderator' });
    expect(role.status).toBe(200);
    expect(role.body.user.role).toBe('moderator');
    expect((await request(app).patch(`/users/${target.id}/role`).set('Authorization', admin.bearer).send({ role: 'root' })).status).toBe(400);

    const block = await request(app).patch(`/users/${target.id}/block`).set('Authorization', admin.bearer).send({ isBlocked: true });
    expect(block.body.user.isBlocked).toBe(true);

    expect((await request(app).delete(`/users/${target.id}`).set('Authorization', admin.bearer)).status).toBe(204);
    expect((await request(app).delete(`/users/${target.id}`).set('Authorization', admin.bearer)).status).toBe(404);
  });

  it('admins cannot demote, block or delete themselves', async () => {
    const admin = await actor('admin');
    const id = admin.user.id;
    expect((await request(app).patch(`/users/${id}/role`).set('Authorization', admin.bearer).send({ role: 'user' })).status).toBe(403);
    expect((await request(app).patch(`/users/${id}/block`).set('Authorization', admin.bearer).send({ isBlocked: true })).status).toBe(403);
    expect((await request(app).delete(`/users/${id}`).set('Authorization', admin.bearer)).status).toBe(403);
  });

  it('validates path params', async () => {
    const admin = await actor('admin');
    expect((await request(app).delete('/users/abc').set('Authorization', admin.bearer)).status).toBe(400);
  });
});
