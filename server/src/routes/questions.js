const router = require('express').Router();
const c = require('../controllers/questionController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const s = require('./schemas');

router.use(authenticate);
router.put('/:id', validate({ params: s.idParams, body: s.questions.update }), c.update);
router.delete('/:id', validate({ params: s.idParams }), c.remove);

module.exports = router;
