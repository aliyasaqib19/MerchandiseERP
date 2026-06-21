const { Router } = require('express');
const { body } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const validate     = require('../middleware/validate');
const ctrl         = require('../controllers/sale.controller');

const router = Router();
router.use(authenticate);

router.get('/stats', authorize('SALES_VIEW'), ctrl.getDashboardStats);
router.get('/',      authorize('SALES_VIEW'), ctrl.getSales);
router.get('/:id',   authorize('SALES_VIEW'), ctrl.getSale);

router.post('/',
  authorize('SALES_CREATE'),
  [body('clientId').isInt(), body('items').isArray({ min: 1 })],
  validate,
  ctrl.createSale
);

router.put('/:id',
  authorize('SALES_UPDATE'),
  [body('clientId').isInt(), body('items').isArray({ min: 1 })],
  validate,
  ctrl.updateSale
);

router.delete('/:id', authorize('SALES_UPDATE'), ctrl.deleteSale);

router.patch('/:id/confirm', authorize('SALES_APPROVE'), ctrl.confirmSale);
router.patch('/:id/deliver', authorize('SALES_UPDATE'),  ctrl.deliverSale);
router.patch('/:id/cancel',  authorize('SALES_APPROVE'), ctrl.cancelSale);

module.exports = router;
