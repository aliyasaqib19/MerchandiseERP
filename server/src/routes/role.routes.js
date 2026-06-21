const { Router } = require('express');
const { body } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { getRoles, getRole, createRole, updateRole, deleteRole } = require('../controllers/role.controller');

const router = Router();

router.use(authenticate);

router.get('/', authorize('ROLES_VIEW'), getRoles);
router.get('/:id', authorize('ROLES_VIEW'), getRole);

router.post(
  '/',
  authorize('ROLES_CREATE'),
  [body('name').notEmpty().trim()],
  validate,
  createRole
);

router.put('/:id', authorize('ROLES_UPDATE'), updateRole);
router.delete('/:id', authorize('ROLES_DELETE'), deleteRole);

module.exports = router;
