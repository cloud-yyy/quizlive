const { expect } = require('@playwright/test');

const PASSWORD = 'Str0ng#Pass';
const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@quizlive.local', password: process.env.ADMIN_PASSWORD || 'Admin#12345' };
let seq = 0;
const uniq = (prefix = 'u') => `${prefix}${Date.now().toString(36)}${(seq += 1)}`;

/** API helpers talk to the same origin the browser uses (nginx -> /api). */
async function apiLogin(request, { email, password }) {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.ok(), `login ${email}`).toBeTruthy();
  return (await res.json()).accessToken;
}

async function apiRegister(request, nickname = uniq('user')) {
  const email = `${nickname}@e2e.local`;
  const res = await request.post('/api/auth/register', { data: { email, password: PASSWORD, nickname } });
  expect(res.status(), 'register').toBe(201);
  const user = (await res.json()).user;
  const token = await apiLogin(request, { email, password: PASSWORD });
  return { user, email, nickname, token, headers: { Authorization: `Bearer ${token}` } };
}

async function adminHeaders(request) {
  return { Authorization: `Bearer ${await apiLogin(request, ADMIN)}` };
}

/** Creates a published quiz through the API. questions: [{ text, options:[{text,isCorrect}], ...}] */
async function apiPublishedQuiz(request, headers, { title = uniq('Quiz '), category = 'e2e', difficulty = 'easy', questions } = {}) {
  const qs = questions || [
    { text: '2 + 2 = ?', type: 'single', timeLimitSec: 10, options: [{ text: '4', isCorrect: true }, { text: '5' }, { text: '22' }] },
  ];
  const created = await request.post('/api/quizzes', { headers, data: { title, category, difficulty, description: 'e2e quiz' } });
  expect(created.status()).toBe(201);
  const quiz = (await created.json()).quiz;
  for (const q of qs) {
    const r = await request.post(`/api/quizzes/${quiz.id}/questions`, { headers, data: q });
    expect(r.status(), JSON.stringify(await r.json())).toBe(201);
  }
  const pub = await request.put(`/api/quizzes/${quiz.id}`, { headers, data: { status: 'published' } });
  expect(pub.status()).toBe(200);
  return { ...quiz, title };
}

/** Logs in through the UI. */
async function uiLogin(page, { email, password = PASSWORD }) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
}

module.exports = { PASSWORD, ADMIN, uniq, apiLogin, apiRegister, adminHeaders, apiPublishedQuiz, uiLogin };
