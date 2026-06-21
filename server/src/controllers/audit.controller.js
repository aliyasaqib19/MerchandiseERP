const prisma = require('../utils/prisma');

async function listAuditLogs(req, res, next) {
  try {
    const { module, userId, resourceType, page = 1, limit = 50, from, to, search } = req.query;
    const where = {};
    if (module)       where.module = module;
    if (userId)       where.userId = Number(userId);
    if (resourceType) where.resourceType = resourceType;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
    }
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { resourceType: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
    ]);
    res.json({ total, page: Number(page), limit: Number(limit), items });
  } catch (err) { next(err); }
}

async function getAuditStats(req, res, next) {
  try {
    const [total, byModule, recentUsers] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.groupBy({ by: ['module'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
      prisma.auditLog.groupBy({
        by: ['userId'],
        _count: { id: true },
        where: { userId: { not: null } },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);
    res.json({ total, byModule, recentUsers });
  } catch (err) { next(err); }
}

// Middleware to log audit actions — call from other controllers
async function logAudit({ userId, action, module, resourceId, resourceType, oldValues, newValues, req: request }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId:       userId       || null,
        action,
        module,
        resourceId:   resourceId   ? String(resourceId)         : null,
        resourceType: resourceType || null,
        oldValues:    oldValues    ? JSON.stringify(oldValues)   : null,
        newValues:    newValues    ? JSON.stringify(newValues)   : null,
        ipAddress:    request?.ip  || null,
        userAgent:    request?.get?.('user-agent') || null,
      },
    });
  } catch (_) { /* never throw from audit */ }
}

module.exports = { listAuditLogs, getAuditStats, logAudit };
