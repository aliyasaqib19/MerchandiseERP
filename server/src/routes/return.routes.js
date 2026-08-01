const { Router } = require('express');
const { body } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const validate     = require('../middleware/validate');
const ctrl         = require('../controllers/return.controller');

const router = Router();
router.use(authenticate);

router.get('/',    authorize('SALES_VIEW'), ctrl.getReturns);
router.get('/:id', authorize('SALES_VIEW'), ctrl.getReturn);

router.post('/',
  authorize('SALES_CREATE'),
  [body('clientId').isInt(), body('items').isArray({ min: 1 })],
  validate,
  ctrl.createReturn
);

router.delete('/:id', authorize('SALES_UPDATE'), ctrl.deleteReturn);

module.exports = router;
