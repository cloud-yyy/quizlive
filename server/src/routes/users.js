const router = require('express').Router();
const c = require('../controllers/userController');
const validate = require('../middleware/validate');
const { authenticate, roleGuard } = require('../middleware/auth');
const s = require('./schemas');

router.use(authenticate, roleGuard('admin'));
router.get('/', validate({ query: s.paging }), c.list);
router.patch('/:id/role', validate({ params: s.idParams, body: s.users.role }), c.setRole);
router.patch('/:id/block', validate({ params: s.idParams, body: s.users.block }), c.setBlocked);
router.delete('/:id', validate({ params: s.idParams }), c.remove);

module.exports = router;
