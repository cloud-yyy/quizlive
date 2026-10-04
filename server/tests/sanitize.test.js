const { app, request, resetDb, actor, sequelize } = require('./helpers');
const { stripTags } = require('../src/utils/sanitize');

beforeAll(resetDb);
afterAll(() => sequelize.close());

describe('stripTags', () => {
  it('removes tags but keeps their text', () => {
    expect(stripTags('<b>Hello</b> world')).toBe('Hello world');
    expect(stripTags('<script>alert(1)</script>')).toBe('alert(1)');
    expect(stripTags('<img src=x onerror=alert(1)>Cat')).toBe('Cat');
  });

  it('cannot be bypassed by nesting or unclosed tags', () => {
    expect(stripTags('<<b>script>alert(1)<</b>/script>')).toBe('alert(1)');
    expect(stripTags('Quiz <script src=//evil')).toBe('Quiz ');
  });

  it('keeps ordinary text with comparison signs', () => {
    expect(stripTags('2 < 3 and 5 > 4')).toBe('2 < 3 and 5 > 4');
  });
});

describe('HTML sanitization of request bodies', () => {
  it('strips tags from quiz fields on create and update', async () => {
    const owner = await actor();
    const res = await request(app)
      .post('/quizzes')
      .set('Authorization', owner.bearer)
      .send({ title: '<b>World</b> capitals', description: '<script>alert(1)</script>Easy', category: '<i>geo</i>' });
    expect(res.status).toBe(201);
    expect(res.body.quiz.title).toBe('World capitals');
    expect(res.body.quiz.description).toBe('alert(1)Easy');
    expect(res.body.quiz.category).toBe('geo');

    const upd = await request(app)
      .put(`/quizzes/${res.body.quiz.id}`)
      .set('Authorization', owner.bearer)
      .send({ title: '<h1>Renamed</h1> quiz' });
    expect(upd.status).toBe(200);
    expect(upd.body.quiz.title).toBe('Renamed quiz');
  });

  it('rejects a title that is empty once the tags are removed', async () => {
    const owner = await actor();
    const res = await request(app).post('/quizzes').set('Authorization', owner.bearer).send({ title: '<b></b><i></i>' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('title');
  });

  it('strips tags from the nickname on registration', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'tags@test.local', password: 'Str0ng#Pass', nickname: '<u>alice</u>' });
    expect(res.status).toBe(201);
    expect(res.body.user.nickname).toBe('alice');
  });
});
