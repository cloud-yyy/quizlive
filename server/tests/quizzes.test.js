const { app, request, resetDb, actor, sequelize } = require('./helpers');

beforeAll(resetDb);
afterAll(() => sequelize.close());

const create = (a, body = {}) =>
  request(app).post('/quizzes').set('Authorization', a.bearer).send({ title: 'World capitals', ...body });

describe('Quiz CRUD with role-based access', () => {
  it('requires authentication to create', async () => {
    expect((await request(app).post('/quizzes').send({ title: 'No auth' })).status).toBe(401);
  });

  it('creates a quiz with generated unique slug and defaults', async () => {
    const owner = await actor();
    const res = await create(owner, { category: 'geo', difficulty: 'easy' });
    expect(res.status).toBe(201);
    expect(res.body.quiz).toMatchObject({ title: 'World capitals', status: 'draft', difficulty: 'easy', ownerId: owner.user.id });
    expect(res.body.quiz.slug).toMatch(/^world-capitals-[0-9a-f]{6}$/);
    expect(res.body.quiz.owner.passwordHash).toBeUndefined();
  });

  it('validates input and rejects mass assignment (ownerId / unknown fields)', async () => {
    const owner = await actor();
    expect((await create(owner, { title: 'x' })).status).toBe(400);
    expect((await create(owner, { difficulty: 'impossible' })).status).toBe(400);
    expect((await create(owner, { ownerId: 999 })).status).toBe(400);
    expect((await create(owner, { slug: 'Bad Slug!' })).status).toBe(400);
  });

  it('enforces a unique slug (409)', async () => {
    const owner = await actor();
    expect((await create(owner, { slug: 'my-unique-slug' })).status).toBe(201);
    expect((await create(owner, { slug: 'my-unique-slug' })).status).toBe(409);
  });

  it('shows drafts only to the owner and staff; published public quizzes to everyone', async () => {
    const owner = await actor();
    const other = await actor();
    const mod = await actor('moderator');
    const draft = (await create(owner, { title: 'Secret draft' })).body.quiz;
    const pub = (await create(owner, { title: 'Open quiz', status: 'published' })).body.quiz;

    expect((await request(app).get(`/quizzes/${draft.id}`)).status).toBe(404);
    expect((await request(app).get(`/quizzes/${draft.id}`).set('Authorization', other.bearer)).status).toBe(404);
    expect((await request(app).get(`/quizzes/${draft.id}`).set('Authorization', owner.bearer)).status).toBe(200);
    expect((await request(app).get(`/quizzes/${draft.id}`).set('Authorization', mod.bearer)).status).toBe(200);
    expect((await request(app).get(`/quizzes/${pub.id}`)).status).toBe(200);

    const anon = await request(app).get('/quizzes');
    const ids = anon.body.items.map((q) => q.id);
    expect(ids).toContain(pub.id);
    expect(ids).not.toContain(draft.id);
    const mine = await request(app).get('/quizzes').set('Authorization', owner.bearer);
    expect(mine.body.items.map((q) => q.id)).toContain(draft.id);
  });

  it('allows only the owner (or admin) to update/delete', async () => {
    const owner = await actor();
    const other = await actor();
    const admin = await actor('admin');
    const quiz = (await create(owner, { status: 'published' })).body.quiz;

    expect((await request(app).put(`/quizzes/${quiz.id}`).set('Authorization', other.bearer).send({ title: 'Hacked' })).status).toBe(403);
    expect((await request(app).delete(`/quizzes/${quiz.id}`).set('Authorization', other.bearer)).status).toBe(403);

    const upd = await request(app).put(`/quizzes/${quiz.id}`).set('Authorization', owner.bearer).send({ title: 'Renamed quiz' });
    expect(upd.status).toBe(200);
    expect(upd.body.quiz.title).toBe('Renamed quiz');
    expect((await request(app).put(`/quizzes/${quiz.id}`).set('Authorization', owner.bearer).send({})).status).toBe(400);

    expect((await request(app).delete(`/quizzes/${quiz.id}`).set('Authorization', admin.bearer)).status).toBe(204);
    expect((await request(app).get(`/quizzes/${quiz.id}`)).status).toBe(404);
  });

  it('moderation: only moderator/admin can hide; hidden quizzes disappear from the public list', async () => {
    const owner = await actor();
    const mod = await actor('moderator');
    const quiz = (await create(owner, { status: 'published' })).body.quiz;

    expect((await request(app).patch(`/quizzes/${quiz.id}/moderation`).set('Authorization', owner.bearer).send({ status: 'hidden' })).status).toBe(403);
    const res = await request(app).patch(`/quizzes/${quiz.id}/moderation`).set('Authorization', mod.bearer).send({ status: 'hidden' });
    expect(res.status).toBe(200);
    expect(res.body.quiz.status).toBe('hidden');
    expect((await request(app).get(`/quizzes/${quiz.id}`)).status).toBe(404);
  });

  it('owner cannot re-publish a quiz hidden by a moderator', async () => {
    const owner = await actor();
    const mod = await actor('moderator');
    const quiz = (await create(owner, { status: 'published' })).body.quiz;
    await request(app).patch(`/quizzes/${quiz.id}/moderation`).set('Authorization', mod.bearer).send({ status: 'hidden' });

    const republish = await request(app).put(`/quizzes/${quiz.id}`).set('Authorization', owner.bearer).send({ status: 'published' });
    expect(republish.status).toBe(403);
    expect((await request(app).get(`/quizzes/${quiz.id}`)).status).toBe(404);

    // other fields stay editable by the owner, and a moderator can restore the quiz
    const rename = await request(app).put(`/quizzes/${quiz.id}`).set('Authorization', owner.bearer).send({ title: 'Renamed while hidden' });
    expect(rename.status).toBe(200);
    expect(rename.body.quiz.status).toBe('hidden');
    const restore = await request(app).patch(`/quizzes/${quiz.id}/moderation`).set('Authorization', mod.bearer).send({ status: 'published' });
    expect(restore.status).toBe(200);
    expect((await request(app).get(`/quizzes/${quiz.id}`)).status).toBe(200);
  });

  it('paginates the list', async () => {
    const owner = await actor();
    for (let i = 0; i < 3; i += 1) await create(owner, { title: `Paged quiz ${i}`, status: 'published' });
    const res = await request(app).get('/quizzes?limit=2&page=1');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    expect((await request(app).get('/quizzes?limit=1000')).status).toBe(400);
  });
});
