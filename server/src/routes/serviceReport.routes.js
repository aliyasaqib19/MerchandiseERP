const { Router } = require('express');
const { body }   = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const validate     = require('../middleware/validate');
const ctrl         = require('../controllers/serviceReport.controller');

const router = Router({ mergeParams: true });
router.use(authenticate);

// Nested under /api/projects/:projectId/reports
router.get('/',  authorize('PROJECTS_VIEW'),   ctrl.listReports);
router.post('/', authorize('PROJECTS_UPDATE'), ctrl.createReport);

// Flat /api/reports/:id
router.get('/:id',            authorize('PROJECTS_VIEW'),   ctrl.getReport);
router.put('/:id',            authorize('PROJECTS_UPDATE'), ctrl.updateReport);
router.post('/:id/signature', authorize('PROJECTS_UPDATE'), [
  body('signatureType').isIn(['client','manager']),
  body('signatureUrl').notEmpty(),
], validate, ctrl.addSignature);
router.post('/:id/approve',   authorize('PROJECTS_APPROVE'), ctrl.approveReport);
router.post('/:id/reject',    authorize('PROJECTS_APPROVE'), ctrl.rejectReport);

module.exports = router;
