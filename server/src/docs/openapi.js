/** OpenAPI 3.0 description of the QuizLive REST API, served by Swagger UI at /docs. */
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ content: { 'application/json': { schema } } });
const err = (description) => ({ description, ...json(ref('Error')) });
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'integer' } };
const sec = [{ bearerAuth: [] }];
const paging = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
];

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'QuizLive API',
    version: '1.0.0',
    description:
      'REST API of the QuizLive platform (real-time quizzes). Access token: `Authorization: Bearer <token>`; the refresh token is stored in an httpOnly cookie.',
  },
  servers: [{ url: '/', description: 'Current host' }],
  tags: [{ name: 'Auth' }, { name: 'Users' }, { name: 'Quizzes' }, { name: 'Questions' }, { name: 'System' }],
  paths: {
    '/health': { get: { tags: ['System'], summary: 'Liveness probe', responses: { 200: { description: 'OK' } } } },
    '/auth/register': {
      post: {
        tags: ['Auth'], summary: 'Register a new user (role is always "user")',
        requestBody: { required: true, ...json(ref('RegisterInput')) },
        responses: { 201: { description: 'Created', ...json({ type: 'object', properties: { user: ref('User') } }) }, 400: err('Validation error / unknown fields'), 409: err('E-mail already registered') },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'], summary: 'Log in; sets the refresh cookie',
        requestBody: { required: true, ...json(ref('LoginInput')) },
        responses: { 200: { description: 'Tokens', ...json(ref('Session')) }, 401: err('Invalid credentials'), 403: err('Account blocked'), 423: err('Account locked after 5 failed attempts') },
      },
    },
    '/auth/refresh': { post: { tags: ['Auth'], summary: 'Rotate refresh token (cookie) and issue a new access token', responses: { 200: { description: 'Tokens', ...json(ref('Session')) }, 401: err('Missing/invalid/reused refresh token') } } },
    '/auth/logout': { post: { tags: ['Auth'], summary: 'Revoke refresh token', responses: { 204: { description: 'Logged out' } } } },
    '/auth/me': { get: { tags: ['Auth'], summary: 'Current user', security: sec, responses: { 200: { description: 'User', ...json({ type: 'object', properties: { user: ref('User') } }) }, 401: err('Unauthorized') } } },
    '/users': { get: { tags: ['Users'], summary: 'List users (admin)', security: sec, parameters: paging, responses: { 200: { description: 'Page of users' }, 401: err('Unauthorized'), 403: err('Forbidden') } } },
    '/users/{id}/role': { patch: { tags: ['Users'], summary: 'Change role (admin)', security: sec, parameters: [idParam], requestBody: { required: true, ...json({ type: 'object', required: ['role'], properties: { role: { type: 'string', enum: ['user', 'moderator', 'admin'] } } }) }, responses: { 200: { description: 'Updated user' }, 403: err('Forbidden'), 404: err('Not found') } } },
    '/users/{id}/block': { patch: { tags: ['Users'], summary: 'Block / unblock a user (admin)', security: sec, parameters: [idParam], requestBody: { required: true, ...json({ type: 'object', required: ['isBlocked'], properties: { isBlocked: { type: 'boolean' } } }) }, responses: { 200: { description: 'Updated user' }, 403: err('Forbidden'), 404: err('Not found') } } },
    '/users/{id}': { delete: { tags: ['Users'], summary: 'Delete a user (admin)', security: sec, parameters: [idParam], responses: { 204: { description: 'Deleted' }, 403: err('Forbidden'), 404: err('Not found') } } },
    '/quizzes': {
      get: {
        tags: ['Quizzes'], summary: 'List / search quizzes',
        description: 'Published public quizzes; signed-in users also see their own, staff sees all. Supports full-text search, filters and sorting.',
        parameters: [
          ...paging,
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Case-insensitive search in title and description' },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'difficulty', in: 'query', schema: { type: 'string', enum: ['easy', 'medium', 'hard'] } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['draft', 'published', 'hidden'] } },
          { name: 'mine', in: 'query', schema: { type: 'boolean' }, description: 'Only my quizzes (requires a token)' },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['newest', 'oldest', 'title', 'questions'], default: 'newest' } },
        ],
        responses: { 200: { description: 'Page of quizzes', ...json({ type: 'object', properties: { items: { type: 'array', items: ref('Quiz') }, total: { type: 'integer' }, page: { type: 'integer' }, limit: { type: 'integer' } } }) }, 400: err('Invalid query') },
      },
      post: { tags: ['Quizzes'], summary: 'Create a quiz (draft)', security: sec, requestBody: { required: true, ...json(ref('QuizInput')) }, responses: { 201: { description: 'Created', ...json({ type: 'object', properties: { quiz: ref('Quiz') } }) }, 400: err('Validation error'), 401: err('Unauthorized'), 409: err('Slug already exists') } },
    },
    '/quizzes/stats': { get: { tags: ['Quizzes'], summary: 'Statistics of the public library (counts by category and difficulty)', responses: { 200: { description: 'Stats' } } } },
    '/quizzes/categories': { get: { tags: ['Quizzes'], summary: 'Distinct categories of published quizzes', responses: { 200: { description: 'Categories' } } } },
    '/quizzes/{id}': {
      get: { tags: ['Quizzes'], summary: 'Quiz with questions (correct answers only for owner/staff)', parameters: [idParam], responses: { 200: { description: 'Quiz' }, 404: err('Not found or not visible') } },
      put: { tags: ['Quizzes'], summary: 'Update a quiz (owner/admin). Publishing requires at least one question.', security: sec, parameters: [idParam], requestBody: { required: true, ...json(ref('QuizUpdate')) }, responses: { 200: { description: 'Updated' }, 400: err('Validation error'), 403: err('Forbidden'), 404: err('Not found') } },
      delete: { tags: ['Quizzes'], summary: 'Delete a quiz (owner/admin)', security: sec, parameters: [idParam], responses: { 204: { description: 'Deleted' }, 403: err('Forbidden'), 404: err('Not found') } },
    },
    '/quizzes/{id}/moderation': { patch: { tags: ['Quizzes'], summary: 'Hide or restore a quiz (moderator/admin)', security: sec, parameters: [idParam], requestBody: { required: true, ...json({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['published', 'hidden'] } } }) }, responses: { 200: { description: 'Updated' }, 403: err('Forbidden') } } },
    '/quizzes/{id}/questions': {
      get: { tags: ['Questions'], summary: 'Questions of my quiz (with correct answers)', security: sec, parameters: [idParam], responses: { 200: { description: 'Questions' }, 403: err('Forbidden'), 404: err('Not found') } },
      post: { tags: ['Questions'], summary: 'Add a question with options', security: sec, parameters: [idParam], requestBody: { required: true, ...json(ref('QuestionInput')) }, responses: { 201: { description: 'Created', ...json({ type: 'object', properties: { question: ref('Question') } }) }, 400: err('Invalid question / options'), 403: err('Forbidden') } },
    },
    '/questions/{id}': {
      put: { tags: ['Questions'], summary: 'Update a question (options are replaced when provided)', security: sec, parameters: [idParam], requestBody: { required: true, ...json(ref('QuestionInput')) }, responses: { 200: { description: 'Updated' }, 400: err('Invalid'), 403: err('Forbidden'), 404: err('Not found') } },
      delete: { tags: ['Questions'], summary: 'Delete a question', security: sec, parameters: [idParam], responses: { 204: { description: 'Deleted' }, 409: err('Last question of a published quiz'), 404: err('Not found') } },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} } } } },
      User: { type: 'object', properties: { id: { type: 'integer' }, email: { type: 'string' }, nickname: { type: 'string' }, role: { type: 'string', enum: ['user', 'moderator', 'admin'] }, isBlocked: { type: 'boolean' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' } } },
      Session: { type: 'object', properties: { accessToken: { type: 'string' }, user: ref('User') } },
      RegisterInput: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', description: '8-72 chars, letter + digit + special character' }, nickname: { type: 'string', minLength: 2, maxLength: 30 } } },
      LoginInput: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } },
      Quiz: { type: 'object', properties: { id: { type: 'integer' }, title: { type: 'string' }, slug: { type: 'string' }, description: { type: 'string' }, category: { type: 'string' }, difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] }, isPublic: { type: 'boolean' }, status: { type: 'string', enum: ['draft', 'published', 'hidden'] }, ownerId: { type: 'integer' }, questionCount: { type: 'integer' }, questions: { type: 'array', items: ref('Question') } } },
      QuizInput: { type: 'object', required: ['title'], properties: { title: { type: 'string', minLength: 3, maxLength: 120 }, slug: { type: 'string', pattern: '^[a-z0-9-]+$', description: 'Unique; generated when omitted' }, description: { type: 'string' }, category: { type: 'string' }, difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] }, isPublic: { type: 'boolean' } } },
      QuizUpdate: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, category: { type: 'string' }, difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] }, isPublic: { type: 'boolean' }, status: { type: 'string', enum: ['draft', 'published'] } } },
      Option: { type: 'object', properties: { id: { type: 'integer' }, text: { type: 'string' }, isCorrect: { type: 'boolean' } } },
      Question: { type: 'object', properties: { id: { type: 'integer' }, text: { type: 'string' }, type: { type: 'string', enum: ['single', 'multiple', 'truefalse'] }, timeLimitSec: { type: 'integer' }, points: { type: 'integer' }, position: { type: 'integer' }, options: { type: 'array', items: ref('Option') } } },
      QuestionInput: { type: 'object', required: ['text', 'options'], properties: { text: { type: 'string' }, type: { type: 'string', enum: ['single', 'multiple', 'truefalse'], default: 'single' }, timeLimitSec: { type: 'integer', minimum: 5, maximum: 120, default: 20 }, points: { type: 'integer', minimum: 100, maximum: 5000, default: 1000 }, position: { type: 'integer' }, options: { type: 'array', minItems: 2, maxItems: 6, items: { type: 'object', required: ['text'], properties: { text: { type: 'string' }, isCorrect: { type: 'boolean' } } } } } },
    },
  },
};
