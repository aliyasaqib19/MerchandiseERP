const prisma = require('../utils/prisma');

async function listNotifications(req, res, next) {
  try {
    const { unreadOnly, page = 1, limit = 30 } = req.query;
    const where = { userId: req.user.id };
    if (unreadOnly === 'true') where.isRead = false;

    const [total, unreadCount, items] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
    ]);
    res.json({ total, unreadCount, page: Number(page), limit: Number(limit), items });
  } catch (err) { next(err); }
}

async function markRead(req, res, next) {
  try {
    const { ids } = req.body; // array of ids or 'all'
    if (ids === 'all') {
      await prisma.notification.updateMany({
        where: { userId: req.user.id, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
    } else if (Array.isArray(ids)) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: req.user.id },
        data: { isRead: true, readAt: new Date() },
      });
    }
    res.json({ message: 'Marked as read' });
  } catch (err) { next(err); }
}

async function deleteNotification(req, res, next) {
  try {
    await prisma.notification.deleteMany({
      where: { id: Number(req.params.id), userId: req.user.id },
    });
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
}

async function createNotification(req, res, next) {
  try {
    const { userId, type, title, message, link } = req.body;
    const notif = await prisma.notification.create({
      data: { userId: Number(userId), type, title, message, link: link || null },
    });
    res.status(201).json(notif);
  } catch (err) { next(err); }
}

module.exports = { listNotifications, markRead, deleteNotification, createNotification };
