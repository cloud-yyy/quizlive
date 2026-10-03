/* Generates quizlive.postman_collection.json:  node docs/postman/build-collection.js */
const fs = require('fs');
const path = require('path');

const json = (o) => JSON.stringify(o, null, 2);
const bearer = '{{accessToken}}';

function req(name, method, url, { body, auth, tests = [], headers = [] } = {}) {
  const request = {
    method,
    header: [...(body ? [{ key: 'Content-Type', value: 'application/json' }] : []), ...headers],
    url: { raw: `{{baseUrl}}${url}`, host: ['{{baseUrl}}'], path: url.split('?')[0].split('/').filter(Boolean), query: url.includes('?') ? url.split('?')[1].split('&').map((p) => { const [key, value] = p.split('='); return { key, value }; }) : undefined },
  };
  if (body) request.body = { mode: 'raw', raw: json(body) };
  if (auth) request.auth = { type: 'bearer', bearer: [{ key: 'token', value: auth, type: 'string' }] };
  return { name, request, event: tests.length ? [{ listen: 'test', script: { type: 'text/javascript', exec: tests } }] : [] };
}

const status = (code) => `pm.test('status is ${code}', () => pm.response.to.have.status(${code}));`;
const save = (varName, expr) => `pm.collectionVariables.set('${varName}', ${expr});`;

const pwd = 'Str0ng#Pass';
const collection = {
  info: {
    name: 'QuizLive API',
    description: 'Run the folders top to bottom (Collection Runner). Requires the API at {{baseUrl}} and the seeded admin account.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:4000' },
    { key: 'adminEmail', value: 'admin@quizlive.local' },
    { key: 'adminPassword', value: 'Admin#12345' },
    { key: 'userEmail', value: `postman_${Date.now()}@test.local` },
    { key: 'password', value: pwd },
    { key: 'accessToken', value: '' },
    { key: 'adminToken', value: '' },
    { key: 'quizId', value: '' },
    { key: 'userId', value: '' },
  ],
  item: [
    { name: '00 Health', item: [req('GET /health', 'GET', '/health', { tests: [status(200)] })] },
    {
      name: '01 Auth',
      item: [
        req('Register', 'POST', '/auth/register', { body: { email: '{{userEmail}}', password: '{{password}}', nickname: 'postman' }, tests: [status(201), save('userId', 'pm.response.json().user.id')] }),
        req('Register – duplicate e-mail (409)', 'POST', '/auth/register', { body: { email: '{{userEmail}}', password: '{{password}}' }, tests: [status(409)] }),
        req('Register – weak password (400)', 'POST', '/auth/register', { body: { email: 'weak@test.local', password: 'abc' }, tests: [status(400)] }),
        req('Register – mass assignment role=admin (400)', 'POST', '/auth/register', { body: { email: 'evil@test.local', password: '{{password}}', role: 'admin' }, tests: [status(400)] }),
        req('Login', 'POST', '/auth/login', { body: { email: '{{userEmail}}', password: '{{password}}' }, tests: [status(200), save('accessToken', 'pm.response.json().accessToken')] }),
        req('Login – wrong password (401)', 'POST', '/auth/login', { body: { email: '{{userEmail}}', password: 'Wrong#Pass1' }, tests: [status(401)] }),
        req('GET /auth/me (with token)', 'GET', '/auth/me', { auth: bearer, tests: [status(200)] }),
        req('GET /auth/me (no token → 401)', 'GET', '/auth/me', { tests: [status(401)] }),
        req('Refresh (uses httpOnly cookie)', 'POST', '/auth/refresh', { tests: [status(200), save('accessToken', 'pm.response.json().accessToken')] }),
        req('Admin login', 'POST', '/auth/login', { body: { email: '{{adminEmail}}', password: '{{adminPassword}}' }, tests: [status(200), save('adminToken', 'pm.response.json().accessToken')] }),
      ],
    },
    {
      name: '02 Quizzes',
      item: [
        req('Create quiz', 'POST', '/quizzes', { auth: bearer, body: { title: 'Postman quiz', category: 'tech', difficulty: 'easy', status: 'published' }, tests: [status(201), save('quizId', 'pm.response.json().quiz.id')] }),
        req('Create quiz – validation error (400)', 'POST', '/quizzes', { auth: bearer, body: { title: 'x' }, tests: [status(400)] }),
        req('Create quiz – no token (401)', 'POST', '/quizzes', { body: { title: 'No token quiz' }, tests: [status(401)] }),
        req('List quizzes (public)', 'GET', '/quizzes?page=1&limit=10', { tests: [status(200)] }),
        req('Get quiz', 'GET', '/quizzes/{{quizId}}', { tests: [status(200)] }),
        req('Update quiz', 'PUT', '/quizzes/{{quizId}}', { auth: bearer, body: { title: 'Postman quiz (edited)' }, tests: [status(200)] }),
        req('Moderate as user (403)', 'PATCH', '/quizzes/{{quizId}}/moderation', { auth: bearer, body: { status: 'hidden' }, tests: [status(403)] }),
        req('Moderate as admin', 'PATCH', '/quizzes/{{quizId}}/moderation', { auth: '{{adminToken}}', body: { status: 'hidden' }, tests: [status(200)] }),
        req('Hidden quiz is not public (404)', 'GET', '/quizzes/{{quizId}}', { tests: [status(404)] }),
        req('Delete quiz', 'DELETE', '/quizzes/{{quizId}}', { auth: bearer, tests: [status(204)] }),
      ],
    },
    {
      name: '03 Users (admin only)',
      item: [
        req('List users as user (403)', 'GET', '/users', { auth: bearer, tests: [status(403)] }),
        req('List users as admin', 'GET', '/users', { auth: '{{adminToken}}', tests: [status(200)] }),
        req('Change role', 'PATCH', '/users/{{userId}}/role', { auth: '{{adminToken}}', body: { role: 'moderator' }, tests: [status(200)] }),
        req('Block user', 'PATCH', '/users/{{userId}}/block', { auth: '{{adminToken}}', body: { isBlocked: true }, tests: [status(200)] }),
        req('Delete user as user (403)', 'DELETE', '/users/{{userId}}', { auth: bearer, tests: [status(403)] }),
        req('Delete user as admin', 'DELETE', '/users/{{userId}}', { auth: '{{adminToken}}', tests: [status(204)] }),
      ],
    },
  ],
};

fs.writeFileSync(path.join(__dirname, 'quizlive.postman_collection.json'), json(collection));
console.log('collection written');
