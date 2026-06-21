const router = require('express').Router();
const auth = require('../middleware/authenticate');
const { salesReport, inventoryReport, projectReport, clientReport, financeReport } = require('../controllers/report.controller');

router.use(auth);

router.get('/sales',     salesReport);
router.get('/inventory', inventoryReport);
router.get('/projects',  projectReport);
router.get('/clients',   clientReport);
router.get('/finance',   financeReport);

module.exports = router;
