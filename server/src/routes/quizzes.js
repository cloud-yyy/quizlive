const router = require('express').Router();
const c = require('../controllers/quizController');
const q = require('../controllers/questionController');
const validate = require('../middleware/validate');
const { authenticate, optionalAuth, roleGuard } = require('../middleware/auth');
const s = require('./schemas');

router.get('/', optionalAuth, validate({ query: s.quizzes.listQuery }), c.list);
router.get('/stats', c.stats);
router.get('/categories', c.categories);
router.get('/:id', optionalAuth, validate({ params: s.idParams }), c.get);
router.post('/', authenticate, validate({ body: s.quizzes.create }), c.create);
router.put('/:id', authenticate, validate({ params: s.idParams, body: s.quizzes.update }), c.update);
router.delete('/:id', authenticate, validate({ params: s.idParams }), c.remove);
router.get('/:id/questions', authenticate, validate({ params: s.idParams }), q.list);
router.post('/:id/questions', authenticate, validate({ params: s.idParams, body: s.questions.create }), q.create);
router.patch(
  '/:id/moderation',
  authenticate,
  roleGuard('moderator'),
  validate({ params: s.idParams, body: s.quizzes.moderation }),
  c.moderate,
);

module.exports = router;
