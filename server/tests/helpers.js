const request = require('supertest');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');
const password = require('../src/utils/password');

const PASSWORD = 'Str0ng#Pass';
let counter = 0;

const resetDb = () => sequelize.sync({ force: true });

async function createUser(role = 'user', overrides = {}) {
  counter += 1;
  return User.create({
    email: `u${counter}_${role}@test.local`,
    nickname: `u${counter}`,
    passwordHash: await password.hash(PASSWORD),
    role,
    ...overrides,
  });
}

async function login(user) {
  const res = await request(app).post('/auth/login').send({ email: user.email, password: PASSWORD });
  return { token: res.body.accessToken, cookies: res.headers['set-cookie'], res };
}

/** Creates a user with the role and returns { user, token, auth(req) }. */
async function actor(role = 'user') {
  const user = await createUser(role);
  const { token } = await login(user);
  return { user, token, bearer: `Bearer ${token}` };
}

module.exports = { app, request, resetDb, createUser, login, actor, PASSWORD, sequelize };
