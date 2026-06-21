const { Router } = require('express');
const { body } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const validate     = require('../middleware/validate');
const ctrl         = require('../controllers/purchaseOrder.controller');

const router = Router();
router.use(authenticate);

router.get('/',    authorize('SALES_VIEW'), ctrl.getPurchaseOrders);
router.get('/:id', authorize('SALES_VIEW'), ctrl.getPurchaseOrder);

router.post('/',
  authorize('SALES_CREATE'),
  [body('clientId').isInt(), body('items').isArray({ min: 1 })],
  validate,
  ctrl.createPurchaseOrder
);

router.put('/:id',
  authorize('SALES_UPDATE'),
  [body('clientId').isInt(), body('items').isArray({ min: 1 })],
  validate,
  ctrl.updatePurchaseOrder
);

router.patch('/:id/status',
  authorize('SALES_APPROVE'),
  [body('status').isIn(['APPROVED', 'REJECTED', 'CANCELLED'])],
  validate,
  ctrl.updateStatus
);

router.post('/:id/convert', authorize('SALES_CREATE'), ctrl.convertToSale);

module.exports = router;
