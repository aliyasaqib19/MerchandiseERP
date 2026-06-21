const prisma = require('../utils/prisma');

async function salesReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const where = { status: 'CONFIRMED' };
    if (from || to) {
      where.saleDate = {};
      if (from) where.saleDate.gte = new Date(from);
      if (to)   where.saleDate.lte = new Date(to);
    }

    const [sales, byMonth, topClients] = await Promise.all([
      prisma.sale.aggregate({
        _sum: { totalAmount: true, discountAmount: true, taxAmount: true },
        _count: { id: true },
        where,
      }),
      prisma.sale.groupBy({
        by: ['saleDate'],
        _sum: { totalAmount: true },
        _count: { id: true },
        where,
        orderBy: { saleDate: 'asc' },
      }),
      prisma.sale.groupBy({
        by: ['clientId'],
        _sum: { totalAmount: true },
        _count: { id: true },
        where,
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 10,
      }),
    ]);

    const clientIds = topClients.map((c) => c.clientId);
    const clients = await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, companyName: true } });
    const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.companyName]));

    res.json({
      summary: {
        totalRevenue: sales._sum.totalAmount || 0,
        totalDiscount: sales._sum.discountAmount || 0,
        totalTax: sales._sum.taxAmount || 0,
        count: sales._count.id,
      },
      byMonth,
      topClients: topClients.map((c) => ({
        clientId: c.clientId,
        companyName: clientMap[c.clientId] || 'Unknown',
        totalAmount: c._sum.totalAmount,
        count: c._count.id,
      })),
    });
  } catch (err) { next(err); }
}

async function inventoryReport(req, res, next) {
  try {
    const [products, lowStock, categories, movementSummary] = await Promise.all([
      prisma.product.aggregate({
        _count: { id: true },
        _sum: { quantity: true },
        where: { status: 'ACTIVE' },
      }),
      prisma.product.count({
        where: { status: 'ACTIVE', quantity: { lte: prisma.product.fields.minThreshold } },
      }).catch(() => 0),
      prisma.category.findMany({
        select: { id: true, name: true, _count: { select: { products: true } } },
      }),
      prisma.inventoryTransaction.groupBy({
        by: ['type'],
        _sum: { quantity: true },
        _count: { id: true },
      }),
    ]);

    const stockValue = await prisma.product.findMany({
      where: { status: 'ACTIVE' },
      select: { quantity: true, costPrice: true, sellingPrice: true },
    });
    const totalCostValue    = stockValue.reduce((s, p) => s + (p.quantity * (p.costPrice    || 0)), 0);
    const totalSellingValue = stockValue.reduce((s, p) => s + (p.quantity * (p.sellingPrice || 0)), 0);

    res.json({
      summary: {
        totalProducts: products._count.id,
        totalUnits:    products._sum.quantity || 0,
        totalCostValue,
        totalSellingValue,
      },
      categories: categories.map((c) => ({ id: c.id, name: c.name, productCount: c._count.products })),
      movementSummary,
    });
  } catch (err) { next(err); }
}

async function projectReport(req, res, next) {
  try {
    const [byStatus, total, avgDuration] = await Promise.all([
      prisma.project.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.project.count(),
      prisma.project.findMany({
        where: { startDate: { not: null }, completedAt: { not: null } },
        select: { startDate: true, completedAt: true },
      }),
    ]);

    const durations = avgDuration
      .map((p) => (new Date(p.completedAt) - new Date(p.startDate)) / (1000 * 60 * 60 * 24))
      .filter((d) => d > 0);
    const avgDays = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    res.json({ total, byStatus, avgCompletionDays: Math.round(avgDays) });
  } catch (err) { next(err); }
}

async function clientReport(req, res, next) {
  try {
    const [byStatus, total, topByRevenue] = await Promise.all([
      prisma.client.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.client.count(),
      prisma.clientTransaction.groupBy({
        by: ['clientId'],
        _sum: { amount: true },
        where: { type: 'PAYMENT' },
        orderBy: { _sum: { amount: 'desc' } },
        take: 10,
      }),
    ]);

    const clientIds = topByRevenue.map((c) => c.clientId);
    const clients = await prisma.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, companyName: true } });
    const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.companyName]));

    res.json({
      total,
      byStatus,
      topByRevenue: topByRevenue.map((c) => ({
        clientId: c.clientId,
        companyName: clientMap[c.clientId] || 'Unknown',
        totalPaid: c._sum.amount,
      })),
    });
  } catch (err) { next(err); }
}

async function financeReport(req, res, next) {
  try {
    const { from, to } = req.query;
    const dateFilter = {};
    if (from || to) {
      dateFilter.date = {};
      if (from) dateFilter.date.gte = new Date(from);
      if (to)   dateFilter.date.lte = new Date(to);
    }

    const [invoiced, collected, outstanding, overdue] = await Promise.all([
      prisma.clientTransaction.aggregate({ _sum: { amount: true }, _count: { id: true }, where: { type: 'INVOICE', ...dateFilter } }),
      prisma.clientTransaction.aggregate({ _sum: { amount: true }, _count: { id: true }, where: { type: 'PAYMENT', ...dateFilter } }),
      prisma.clientTransaction.groupBy({
        by: ['clientId'],
        _sum: { amount: true },
        where: { type: { in: ['INVOICE', 'PAYMENT', 'CREDIT_NOTE', 'DEBIT_NOTE'] } },
        having: { amount: { _sum: { gt: 0 } } },
      }),
      prisma.clientTransaction.count({
        where: { type: 'INVOICE', dueDate: { lt: new Date() }, ...dateFilter },
      }),
    ]);

    const totalOutstanding = outstanding.reduce((s, c) => s + (c._sum.amount || 0), 0);

    res.json({
      invoiced:    { total: invoiced._sum.amount  || 0, count: invoiced._count.id },
      collected:   { total: collected._sum.amount || 0, count: collected._count.id },
      outstanding: { total: Math.max(totalOutstanding, 0) },
      overdueCount: overdue,
    });
  } catch (err) { next(err); }
}

module.exports = { salesReport, inventoryReport, projectReport, clientReport, financeReport };
