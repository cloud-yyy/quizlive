const { app, request, resetDb, actor, sequelize } = require('./helpers');

beforeAll(resetDb);
afterAll(() => sequelize.close());

const mkQuiz = async (a, body = {}) =>
  (await request(app).post('/quizzes').set('Authorization', a.bearer).send({ title: 'Question tests', ...body })).body.quiz;
const addQ = (a, quizId, body) => request(app).post(`/quizzes/${quizId}/questions`).set('Authorization', a.bearer).send(body);
const valid = { text: 'Largest planet?', type: 'single', timeLimitSec: 15, points: 500, options: [{ text: 'Jupiter', isCorrect: true }, { text: 'Mars' }, { text: 'Venus' }] };

describe('Questions & options', () => {
  it('creates a question with options, auto-positioned, and lists them to the owner', async () => {
    const owner = await actor();
    const quiz = await mkQuiz(owner);
    const a = await addQ(owner, quiz.id, valid);
    expect(a.status).toBe(201);
    expect(a.body.question).toMatchObject({ text: 'Largest planet?', timeLimitSec: 15, points: 500, position: 0 });
    expect(a.body.question.options).toHaveLength(3);
    const b = await addQ(owner, quiz.id, { ...valid, text: 'Second question' });
    expect(b.body.question.position).toBe(1);
    const list = await request(app).get(`/quizzes/${quiz.id}/questions`).set('Authorization', owner.bearer);
    expect(list.body.items.map((q) => q.text)).toEqual(['Largest planet?', 'Second question']);
    expect(list.body.items[0].options.find((o) => o.isCorrect).text).toBe('Jupiter');
  });

  it.each([
    ['single with 2 correct', { type: 'single', options: [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: true }] }],
    ['single with no correct', { type: 'single', options: [{ text: 'a' }, { text: 'b' }] }],
    ['truefalse with 3 options', { type: 'truefalse', options: [{ text: 'a', isCorrect: true }, { text: 'b' }, { text: 'c' }] }],
    ['multiple with none correct', { type: 'multiple', options: [{ text: 'a' }, { text: 'b' }] }],
    ['duplicate option texts', { type: 'single', options: [{ text: 'same', isCorrect: true }, { text: 'Same' }] }],
    ['only one option', { type: 'single', options: [{ text: 'a', isCorrect: true }] }],
    ['unknown field', { quizId: 5 }],
  ])('rejects invalid question: %s', async (_n, patch) => {
    const owner = await actor();
    const quiz = await mkQuiz(owner);
    expect((await addQ(owner, quiz.id, { ...valid, ...patch })).status).toBe(400);
  });

  it('strips HTML tags from question and option text (measure #19)', async () => {
    const owner = await actor();
    const quiz = await mkQuiz(owner);
    const res = await addQ(owner, quiz.id, {
      ...valid,
      text: 'Largest <script>alert(1)</script>planet?',
      options: [{ text: '<b>Jupiter</b>', isCorrect: true }, { text: 'Mars' }],
    });
    expect(res.status).toBe(201);
    expect(res.body.question.text).toBe('Largest alert(1)planet?');
    expect(res.body.question.options.map((o) => o.text).sort()).toEqual(['Jupiter', 'Mars']);
    expect((await addQ(owner, quiz.id, { ...valid, text: '<i></i>' })).status).toBe(400);
  });

  it('accepts multiple-answer and true/false questions', async () => {
    const owner = await actor();
    const quiz = await mkQuiz(owner);
    const multi = await addQ(owner, quiz.id, { text: 'Primes?', type: 'multiple', options: [{ text: '2', isCorrect: true }, { text: '3', isCorrect: true }, { text: '4' }] });
    expect(multi.status).toBe(201);
    const tf = await addQ(owner, quiz.id, { text: 'The Earth is flat', type: 'truefalse', options: [{ text: 'True' }, { text: 'False', isCorrect: true }] });
    expect(tf.status).toBe(201);
  });

  it('only the owner can add/edit/delete; other users get 404/403', async () => {
    const owner = await actor();
    const other = await actor();
    const quiz = await mkQuiz(owner);
    const q = (await addQ(owner, quiz.id, valid)).body.question;
    expect((await addQ(other, quiz.id, valid)).status).toBe(404); // draft is invisible to others
    const pub = await mkQuiz(owner, { title: 'Public one' });
    await addQ(owner, pub.id, valid);
    await request(app).put(`/quizzes/${pub.id}`).set('Authorization', owner.bearer).send({ status: 'published' });
    expect((await addQ(other, pub.id, valid)).status).toBe(403);
    expect((await request(app).put(`/questions/${q.id}`).set('Authorization', other.bearer).send({ text: 'Hacked?!' })).status).toBe(404); // draft quiz: invisible
    expect((await request(app).delete(`/questions/${q.id}`).set('Authorization', other.bearer)).status).toBe(404);
    expect((await request(app).put(`/questions/${q.id}`).send({ text: 'Anon edit' })).status).toBe(401);
  });

  it('updates a question and replaces its options', async () => {
    const owner = await actor();
    const quiz = await mkQuiz(owner);
    const q = (await addQ(owner, quiz.id, valid)).body.question;
    const upd = await request(app)
      .put(`/questions/${q.id}`)
      .set('Authorization', owner.bearer)
      .send({ text: 'Smallest planet?', options: [{ text: 'Mercury', isCorrect: true }, { text: 'Earth' }] });
    expect(upd.status).toBe(200);
    expect(upd.body.question.text).toBe('Smallest planet?');
    expect(upd.body.question.options.map((o) => o.text)).toEqual(['Mercury', 'Earth']);
    // changing the type alone must keep options consistent
    const bad = await request(app).put(`/questions/${q.id}`).set('Authorization', owner.bearer).send({ type: 'multiple' });
    expect(bad.status).toBe(200);
    const bad2 = await request(app).put(`/questions/${q.id}`).set('Authorization', owner.bearer).send({ type: 'truefalse' });
    expect(bad2.status).toBe(200);
    const bad3 = await request(app).put(`/questions/${q.id}`).set('Authorization', owner.bearer).send({ type: 'single', options: [{ text: 'x' }, { text: 'y' }] });
    expect(bad3.status).toBe(400);
  });

  it('publishing needs at least one question; the last question of a published quiz cannot be removed', async () => {
    const owner = await actor();
    const quiz = await mkQuiz(owner);
    const pubEmpty = await request(app).put(`/quizzes/${quiz.id}`).set('Authorization', owner.bearer).send({ status: 'published' });
    expect(pubEmpty.status).toBe(400);
    const q = (await addQ(owner, quiz.id, valid)).body.question;
    expect((await request(app).put(`/quizzes/${quiz.id}`).set('Authorization', owner.bearer).send({ status: 'published' })).status).toBe(200);
    expect((await request(app).delete(`/questions/${q.id}`).set('Authorization', owner.bearer)).status).toBe(409);
    await request(app).put(`/quizzes/${quiz.id}`).set('Authorization', owner.bearer).send({ status: 'draft' });
    expect((await request(app).delete(`/questions/${q.id}`).set('Authorization', owner.bearer)).status).toBe(204);
  });

  it('quiz detail hides correct answers from non-owners but shows them to the owner', async () => {
    const owner = await actor();
    const quiz = await mkQuiz(owner, { title: 'Answers hidden' });
    await addQ(owner, quiz.id, valid);
    await request(app).put(`/quizzes/${quiz.id}`).set('Authorization', owner.bearer).send({ status: 'published' });
    const anon = await request(app).get(`/quizzes/${quiz.id}`);
    expect(anon.body.quiz.questions[0].options.every((o) => o.isCorrect === undefined)).toBe(true);
    const mine = await request(app).get(`/quizzes/${quiz.id}`).set('Authorization', owner.bearer);
    expect(mine.body.quiz.questions[0].options.some((o) => o.isCorrect === true)).toBe(true);
    expect(anon.body.quiz.questionCount).toBe(1);
  });
});

describe('Search, filters, sorting and statistics (KR1 additional endpoints)', () => {
  let owner;
  beforeAll(async () => {
    await resetDb();
    owner = await actor();
    const defs = [
      { title: 'JavaScript basics', category: 'tech', difficulty: 'easy', qs: 1 },
      { title: 'Advanced JavaScript', category: 'tech', difficulty: 'hard', qs: 3 },
      { title: 'European capitals', category: 'geo', difficulty: 'medium', qs: 2 },
      { title: '100% pure_fun', category: 'fun', difficulty: 'easy', qs: 1 },
    ];
    for (const d of defs) {
      const quiz = await mkQuiz(owner, { title: d.title, category: d.category, difficulty: d.difficulty });
      for (let i = 0; i < d.qs; i += 1) await addQ(owner, quiz.id, { ...valid, text: `Question number ${i}` });
      await request(app).put(`/quizzes/${quiz.id}`).set('Authorization', owner.bearer).send({ status: 'published' });
    }
    await mkQuiz(owner, { title: 'My draft about javascript', category: 'tech' });
  });

  const titles = (res) => res.body.items.map((q) => q.title);

  it('searches by text (case-insensitive) in title/description', async () => {
    expect(titles(await request(app).get('/quizzes?q=javascript')).sort()).toEqual(['Advanced JavaScript', 'JavaScript basics']);
    expect(titles(await request(app).get('/quizzes?q=EUROPEAN'))).toEqual(['European capitals']);
  });

  it('treats LIKE wildcards literally', async () => {
    expect(titles(await request(app).get(`/quizzes?q=${encodeURIComponent('100%')}`))).toEqual(['100% pure_fun']);
    expect(titles(await request(app).get('/quizzes?q=%25'))).toEqual(['100% pure_fun']);
  });

  it('filters by category and difficulty and combines filters', async () => {
    expect(titles(await request(app).get('/quizzes?category=geo'))).toEqual(['European capitals']);
    expect(titles(await request(app).get('/quizzes?difficulty=easy')).sort()).toEqual(['100% pure_fun', 'JavaScript basics']);
    expect(titles(await request(app).get('/quizzes?category=tech&difficulty=hard'))).toEqual(['Advanced JavaScript']);
    expect((await request(app).get('/quizzes?difficulty=insane')).status).toBe(400);
  });

  it('sorts by title and by number of questions and exposes questionCount', async () => {
    const byTitle = await request(app).get('/quizzes?sort=title');
    expect(titles(byTitle)).toEqual([...titles(byTitle)].sort((a, b) => a.localeCompare(b)));
    const byQ = await request(app).get('/quizzes?sort=questions');
    expect(byQ.body.items[0]).toMatchObject({ title: 'Advanced JavaScript', questionCount: 3 });
  });

  it('"mine" lists the caller\'s drafts too and requires a token', async () => {
    expect((await request(app).get('/quizzes?mine=true')).status).toBe(403);
    const res = await request(app).get('/quizzes?mine=true&status=draft').set('Authorization', owner.bearer);
    expect(titles(res)).toEqual(['My draft about javascript']);
  });

  it('GET /quizzes/stats aggregates the published library', async () => {
    const res = await request(app).get('/quizzes/stats');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.totalQuestions).toBe(7);
    expect(res.body.byCategory[0]).toEqual({ category: 'tech', count: 2 });
    expect(res.body.byDifficulty.find((d) => d.difficulty === 'easy').count).toBe(2);
  });

  it('GET /quizzes/categories lists distinct categories', async () => {
    const res = await request(app).get('/quizzes/categories');
    expect(res.body.items).toEqual(['fun', 'geo', 'tech']);
  });
});
