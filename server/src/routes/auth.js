const router = require('express').Router();
const c = require('../controllers/authController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const s = require('./schemas');

router.post('/register', authLimiter, validate({ body: s.auth.register }), c.register);
router.post('/login', authLimiter, validate({ body: s.auth.login }), c.login);
router.post('/refresh', authLimiter, c.refresh);
router.post('/logout', c.logout);
router.get('/me', authenticate, c.me);

module.exports = router;
