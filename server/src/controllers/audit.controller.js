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

    const enriched = await attachResourceNames(items);
    res.json({ total, page: Number(page), limit: Number(limit), items: enriched });
  } catch (err) { next(err); }
}

// Resolve a human-readable name for each audit log's changed resource
const RESOURCE_CONFIG = {
  Product:         { model: 'product',         field: 'name' },
  Brand:           { model: 'brand',           field: 'name' },
  Category:        { model: 'category',        field: 'name' },
  Warehouse:       { model: 'warehouse',       field: 'name' },
  Client:          { model: 'client',          field: 'companyName' },
  Quotation:       { model: 'quotation',       field: 'quotationNumber' },
  Sale:            { model: 'sale',            field: 'saleNumber' },
  PurchaseOrder:   { model: 'purchaseOrder',   field: 'poNumber' },
  Project:         { model: 'project',         field: 'title' },
  Shipment:        { model: 'shipment',        field: 'shipmentNumber' },
  Document:        { model: 'document',        field: 'title' },
  ApprovalRequest: { model: 'approvalRequest', field: 'title' },
  User:            { model: 'user',            field: 'fullName' },
  Role:            { model: 'role',            field: 'name' },
};

async function attachResourceNames(items) {
  const byType = {};
  for (const it of items) {
    const cfg = RESOURCE_CONFIG[it.resourceType];
    if (!cfg || !it.resourceId) continue;
    const id = Number(it.resourceId);
    if (Number.isNaN(id)) continue;
    (byType[it.resourceType] ||= new Set()).add(id);
  }

  const nameMaps = {};
  for (const [type, idSet] of Object.entries(byType)) {
    const cfg = RESOURCE_CONFIG[type];
    try {
      const rows = await prisma[cfg.model].findMany({
        where: { id: { in: [...idSet] } },
        select: { id: true, [cfg.field]: true },
      });
      nameMaps[type] = Object.fromEntries(rows.map((r) => [r.id, r[cfg.field]]));
    } catch (_) {
      nameMaps[type] = {};
    }
  }

  return items.map((it) => ({
    ...it,
    resourceName:
      it.resourceType && it.resourceId
        ? nameMaps[it.resourceType]?.[Number(it.resourceId)] || null
        : null,
  }));
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
