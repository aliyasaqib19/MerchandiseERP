const { Router } = require('express');
const { body }   = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const validate     = require('../middleware/validate');
const ctrl         = require('../controllers/finance.controller');

const router = Router();
router.use(authenticate);

router.get('/stats',                           authorize('FINANCE_VIEW'),   ctrl.getStats);
router.get('/invoices',                        authorize('FINANCE_VIEW'),   ctrl.getInvoices);
router.get('/payments',                        authorize('FINANCE_VIEW'),   ctrl.getPayments);
router.get('/outstanding',                     authorize('FINANCE_VIEW'),   ctrl.getOutstanding);
router.get('/aged-receivables',                authorize('FINANCE_VIEW'),   ctrl.getAgedReceivables);
router.get('/clients/:clientId/balance',       authorize('FINANCE_VIEW'),   ctrl.getClientBalance);

router.post('/payments',
  authorize('FINANCE_CREATE'),
  [
    body('clientId').isInt(),
    body('amount').isFloat({ min: 0.01 }),
    body('description').optional().isString().trim(),
  ],
  validate,
  ctrl.recordPayment
);

module.exports = router;
