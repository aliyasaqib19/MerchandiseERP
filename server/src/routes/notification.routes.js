const router = require('express').Router();
const auth = require('../middleware/authenticate');
const { listNotifications, markRead, deleteNotification, createNotification } = require('../controllers/notification.controller');

router.use(auth);

router.get('/',          listNotifications);
router.post('/mark-read', markRead);
router.post('/',         createNotification);
router.delete('/:id',    deleteNotification);

module.exports = router;
