const router = require('express').Router();
const auth = require('../middleware/authenticate');
const { listApprovals, getStats, getApproval, createApproval, decide, updateApproval, cancelApproval } = require('../controllers/approval.controller');

router.use(auth);

router.get('/',          listApprovals);
router.get('/stats',     getStats);
router.get('/:id',       getApproval);
router.post('/',         createApproval);
router.put('/:id',          updateApproval);
router.post('/:id/decide',  decide);
router.post('/:id/cancel',  cancelApproval);

module.exports = router;
