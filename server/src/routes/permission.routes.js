const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { getPermissions } = require('../controllers/permission.controller');

const router = Router();

router.use(authenticate);
router.get('/', authorize('ROLES_VIEW'), getPermissions);

module.exports = router;
