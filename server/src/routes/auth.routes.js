const { Router } = require('express');
const { body } = require('express-validator');
const { login, refresh, logout, forgotPassword, me, updateProfile, changePassword } = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');

const router = Router();

router.post(
  '/login',
  [body('email').isEmail(), body('password').notEmpty()],
  validate,
  login
);

router.post('/refresh', refresh);
router.post('/logout', logout);

router.post(
  '/forgot-password',
  [body('email').isEmail()],
  validate,
  forgotPassword
);

router.get('/me', authenticate, me);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);

module.exports = router;
