const { Router } = require('express');
const { body } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const validate     = require('../middleware/validate');
const ctrl         = require('../controllers/quotation.controller');

const router = Router();
router.use(authenticate);

router.get('/stats', authorize('SALES_VIEW'), ctrl.getStats);
router.get('/',      authorize('SALES_VIEW'), ctrl.getQuotations);
router.get('/:id',   authorize('SALES_VIEW'), ctrl.getQuotation);

router.post('/',
  authorize('SALES_CREATE'),
  [body('clientId').isInt(), body('items').isArray({ min: 1 })],
  validate,
  ctrl.createQuotation
);

router.put('/:id',
  authorize('SALES_UPDATE'),
  [body('clientId').isInt(), body('items').isArray({ min: 1 })],
  validate,
  ctrl.updateQuotation
);

router.delete('/:id', authorize('SALES_UPDATE'), ctrl.deleteQuotation);

router.patch('/:id/status',
  authorize('SALES_APPROVE'),
  [body('status').isIn(['SENT', 'APPROVED', 'REJECTED', 'EXPIRED'])],
  validate,
  ctrl.updateStatus
);

router.post('/:id/convert', authorize('SALES_CREATE'), ctrl.convertToSale);

module.exports = router;
