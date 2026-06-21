const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const ctrl         = require('../controllers/workLog.controller');

const router = Router({ mergeParams: true });
router.use(authenticate);

// Nested under /api/projects/:projectId/work-logs
router.get('/',  authorize('PROJECTS_VIEW'),   ctrl.listLogs);
router.post('/', authorize('PROJECTS_UPDATE'), ctrl.createLog);

// Flat /api/work-logs/:id
router.get('/:id',          authorize('PROJECTS_VIEW'),   ctrl.getLog);
router.put('/:id',          authorize('PROJECTS_UPDATE'), ctrl.updateLog);
router.post('/:id/photos',  authorize('PROJECTS_UPDATE'), ctrl.addPhotosToLog);

module.exports = router;
