const { Router } = require('express');
const { body } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
} = require('../controllers/user.controller');

const router = Router();

router.use(authenticate);

router.get('/', authorize('USERS_VIEW'), getUsers);
router.get('/:id', authorize('USERS_VIEW'), getUser);

router.post(
  '/',
  authorize('USERS_CREATE'),
  [
    body('fullName').notEmpty().trim(),
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('roleId').optional().isInt(),
    body('roleIds').optional().isArray(),
  ],
  validate,
  createUser
);

router.put('/:id', authorize('USERS_UPDATE'), updateUser);

router.delete('/:id', authorize('USERS_DELETE'), deleteUser);

router.post(
  '/:id/reset-password',
  authorize('USERS_UPDATE'),
  [body('password').isLength({ min: 8 })],
  validate,
  resetUserPassword
);

module.exports = router;
