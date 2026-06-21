const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const ctrl         = require('../controllers/siteVisit.controller');

const router = Router({ mergeParams: true });
router.use(authenticate);

// Nested under /api/projects/:projectId/visits
router.get('/',    authorize('PROJECTS_VIEW'),   ctrl.listVisits);
router.post('/',   authorize('PROJECTS_UPDATE'), ctrl.createVisit);

// Flat /api/visits/:id
router.get('/:id',              authorize('PROJECTS_VIEW'),   ctrl.getVisit);
router.put('/:id',              authorize('PROJECTS_UPDATE'), ctrl.updateVisit);
router.post('/:id/photos',      authorize('PROJECTS_UPDATE'), ctrl.addPhotos);
router.delete('/:id/photos/:photoId', authorize('PROJECTS_UPDATE'), ctrl.deletePhoto);

module.exports = router;
