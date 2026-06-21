const router = require('express').Router();
const auth = require('../middleware/authenticate');
const { listAuditLogs, getAuditStats } = require('../controllers/audit.controller');

router.use(auth);

router.get('/',       listAuditLogs);
router.get('/stats',  getAuditStats);

module.exports = router;
