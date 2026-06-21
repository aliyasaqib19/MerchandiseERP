const { Router } = require('express');
const { body }   = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const validate     = require('../middleware/validate');
const ctrl         = require('../controllers/project.controller');

const router = Router();
router.use(authenticate);

router.get('/stats',                authorize('PROJECTS_VIEW'),   ctrl.getStats);
router.get('/',                     authorize('PROJECTS_VIEW'),   ctrl.listProjects);
router.get('/:id',                  authorize('PROJECTS_VIEW'),   ctrl.getProject);
router.get('/:id/timeline',         authorize('PROJECTS_VIEW'),   ctrl.getTimeline);

router.post('/',
  authorize('PROJECTS_CREATE'),
  [
    body('title').notEmpty().trim(),
    body('clientId').isInt(),
    body('managerId').isInt(),
  ],
  validate,
  ctrl.createProject
);

router.put('/:id',        authorize('PROJECTS_UPDATE'), ctrl.updateProject);
router.patch('/:id/status', authorize('PROJECTS_UPDATE'), ctrl.updateStatus);

router.post('/:id/assignments',
  authorize('PROJECTS_UPDATE'),
  [body('assignments').isArray()],
  validate,
  ctrl.assignTeam
);

router.delete('/:id/assignments/:userId', authorize('PROJECTS_UPDATE'), ctrl.removeAssignment);

module.exports = router;
