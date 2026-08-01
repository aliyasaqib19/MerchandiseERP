const { Router } = require('express');
const { body } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const validate     = require('../middleware/validate');
const ctrl         = require('../controllers/demo.controller');

const router = Router();
router.use(authenticate);

router.get('/',    authorize('SALES_VIEW'), ctrl.getDemoItems);
router.get('/:id', authorize('SALES_VIEW'), ctrl.getDemoItem);

router.post('/',
  authorize('SALES_CREATE'),
  [body('clientId').isInt(), body('productId').isInt(), body('quantity').isFloat({ gt: 0 })],
  validate,
  ctrl.createDemoItem
);

router.patch('/:id/return', authorize('SALES_UPDATE'), ctrl.markReturned);
router.delete('/:id',       authorize('SALES_UPDATE'), ctrl.deleteDemoItem);

module.exports = router;
