const prisma = require('../utils/prisma');
const { generateDocNumber } = require('../utils/numberGen');
const { logAudit } = require('./audit.controller');

const SALE_INCLUDE = {
  client:        { select: { id: true, companyName: true, email: true, taxNumber: true, address: true, city: true, country: true } },
  quotation:     { select: { id: true, quotationNumber: true } },
  purchaseOrder: { select: { id: true, poNumber: true } },
  createdByUser: { select: { id: true, fullName: true } },
  invoice:       { select: { id: true, amount: true, date: true, reference: true } },
  items: {
    include: { product: { select: { id: true, name: true, sku: true, unitType: true, quantity: true } } },
    orderBy: { id: 'asc' },
  },
};

function computeSaleTotals(items, discountAmount, taxRate) {
  const subtotal = items.reduce((sum, item) => {
    return sum + Number(item.quantity) * Number(item.unitPrice) * (1 - (Number(item.discount) || 0) / 100);
  }, 0);
  const da = Number(discountAmount) || 0;
  const taxAmount = (subtotal - da) * (Number(taxRate) || 0) / 100;
  return { subtotal, discountAmount: da, taxAmount, totalAmount: subtotal - da + taxAmount };
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

async function getDashboardStats(req, res) {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const db = prisma.base;
  const wWhere = req.warehouseId ? { warehouseId: req.warehouseId } : {};

  const [
    quoteStats, poStats, saleStats, revenueAgg, recentSales,
  ] = await Promise.all([
    // Quotation counts
    db.quotation.groupBy({ by: ['status'], _count: true, where: wWhere }),
    // PO counts
    db.purchaseOrder.groupBy({ by: ['status'], _count: true, where: wWhere }),
    // Sale counts this month
    Promise.all([
      db.sale.count({ where: { createdAt: { gte: startOfMonth }, ...wWhere } }),
      db.sale.count({ where: { status: 'CONFIRMED', createdAt: { gte: startOfMonth }, ...wWhere } }),
      db.sale.count({ where: { status: 'DELIVERED', createdAt: { gte: startOfMonth }, ...wWhere } }),
    ]),
    // Revenue this month (confirmed + delivered)
    db.sale.aggregate({
      where: { status: { in: ['CONFIRMED', 'DELIVERED'] }, createdAt: { gte: startOfMonth }, ...wWhere },
      _sum: { totalAmount: true },
    }),
    // Recent sales
    db.sale.findMany({
      where: wWhere,
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: {
        client:        { select: { companyName: true } },
        createdByUser: { select: { fullName: true } },
      },
    }),
  ]);

  const quoteMap = Object.fromEntries(quoteStats.map((r) => [r.status, r._count]));
  const poMap    = Object.fromEntries(poStats.map((r) => [r.status, r._count]));
  const [saleTotal, saleConfirmed, saleDelivered] = saleStats;

  res.json({
    quotations: {
      total:    Object.values(quoteMap).reduce((a, b) => a + b, 0),
      draft:    quoteMap.DRAFT    || 0,
      sent:     quoteMap.SENT     || 0,
      approved: quoteMap.APPROVED || 0,
    },
    purchaseOrders: {
      pending:  poMap.PENDING  || 0,
      approved: poMap.APPROVED || 0,
    },
    sales: {
      thisMonth: saleTotal,
      confirmed: saleConfirmed,
      delivered: saleDelivered,
      revenue:   revenueAgg._sum.totalAmount || 0,
    },
    recentSales,
  });
}

// ─── Sales CRUD ───────────────────────────────────────────────────────────────

async function getSales(req, res) {
  const { search, status, clientId, page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const where = {};

  if (status) where.status = status;
  if (clientId) where.clientId = Number(clientId);
  if (req.warehouseId) where.warehouseId = req.warehouseId;
  if (search) {
    where.OR = [
      { saleNumber: { contains: search, mode: 'insensitive' } },
      { client: { companyName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [sales, total] = await Promise.all([
    prisma.base.sale.findMany({
      where,
      include: {
        client:        { select: { id: true, companyName: true } },
        quotation:     { select: { quotationNumber: true } },
        purchaseOrder: { select: { poNumber: true } },
        createdByUser: { select: { fullName: true } },
        _count:        { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.base.sale.count({ where }),
  ]);

  res.json({ sales, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
}

async function getSale(req, res) {
  const sale = await prisma.sale.findUnique({
    where: { id: Number(req.params.id) },
    include: SALE_INCLUDE,
  });
  if (!sale) return res.status(404).json({ message: 'Sale not found' });
  res.json(sale);
}

async function createSale(req, res) {
  const {
    clientId, quotationId, poId, saleDate, notes,
    discountAmount = 0, taxRate = 0, items = [],
  } = req.body;

  const saleNumber = await generateDocNumber('sale', 'saleNumber', 'SALE');
  const { subtotal, discountAmount: da, taxAmount, totalAmount } = computeSaleTotals(items, discountAmount, taxRate);

  const sale = await prisma.base.sale.create({
    data: {
      saleNumber,
      clientId:   Number(clientId),
      quotationId: quotationId ? Number(quotationId) : null,
      poId:        poId ? Number(poId) : null,
      createdBy:   req.user.id,
      notes,
      subtotal, discountAmount: da, taxRate: Number(taxRate), taxAmount, totalAmount,
      saleDate:    saleDate ? new Date(saleDate) : new Date(),
      warehouseId: req.warehouseId || null,
      items: {
        create: items.map((item) => ({
          productId:   item.productId ? Number(item.productId) : null,
          description: item.description,
          quantity:    Number(item.quantity),
          unitPrice:   Number(item.unitPrice),
          costPrice:   Number(item.costPrice) || 0,
          discount:    Number(item.discount) || 0,
          total:       Number(item.quantity) * Number(item.unitPrice) * (1 - (Number(item.discount) || 0) / 100),
        })),
      },
    },
    include: SALE_INCLUDE,
  });

  logAudit({ userId: req.user.id, action: 'CREATE', module: 'SALES', resourceId: sale.id, resourceType: 'Sale', newValues: { saleNumber: sale.saleNumber, clientId, totalAmount: sale.totalAmount }, req });
  res.status(201).json(sale);
}

async function updateSale(req, res) {
  const id = Number(req.params.id);
  const existing = await prisma.sale.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Not found' });
  if (existing.status !== 'DRAFT') return res.status(400).json({ message: 'Only DRAFT sales can be edited' });

  const { clientId, quotationId, poId, saleDate, notes, discountAmount = 0, taxRate = 0, items = [] } = req.body;
  const { subtotal, discountAmount: da, taxAmount, totalAmount } = computeSaleTotals(items, discountAmount, taxRate);

  const sale = await prisma.base.$transaction(async (tx) => {
    await tx.saleItem.deleteMany({ where: { saleId: id } });
    return tx.sale.update({
      where: { id },
      data: {
        clientId:   Number(clientId),
        quotationId: quotationId ? Number(quotationId) : null,
        poId:        poId ? Number(poId) : null,
        notes,
        subtotal, discountAmount: da, taxRate: Number(taxRate), taxAmount, totalAmount,
        saleDate:    saleDate ? new Date(saleDate) : undefined,
        items: {
          create: items.map((item) => ({
            productId:   item.productId ? Number(item.productId) : null,
            description: item.description,
            quantity:    Number(item.quantity),
            unitPrice:   Number(item.unitPrice),
            costPrice:   Number(item.costPrice) || 0,
            discount:    Number(item.discount) || 0,
            total:       Number(item.quantity) * Number(item.unitPrice) * (1 - (Number(item.discount) || 0) / 100),
          })),
        },
      },
      include: SALE_INCLUDE,
    });
  });

  logAudit({ userId: req.user.id, action: 'UPDATE', module: 'SALES', resourceId: id, resourceType: 'Sale', newValues: { totalAmount: sale.totalAmount }, req });
  res.json(sale);
}

async function deleteSale(req, res) {
  const id = Number(req.params.id);
  const sale = await prisma.sale.findUnique({ where: { id } });
  if (!sale) return res.status(404).json({ message: 'Not found' });
  if (sale.status !== 'DRAFT') return res.status(400).json({ message: 'Only DRAFT sales can be deleted' });
  await prisma.sale.delete({ where: { id } });
  logAudit({ userId: req.user.id, action: 'DELETE', module: 'SALES', resourceId: id, resourceType: 'Sale', req });
  res.json({ message: 'Sale deleted' });
}

// ─── Confirm Sale (core ERP workflow) ─────────────────────────────────────────

async function confirmSale(req, res) {
  const id = Number(req.params.id);

  const result = await prisma.base.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        client: true,
      },
    });

    if (!sale) throw Object.assign(new Error('Sale not found'), { status: 404 });
    if (sale.status !== 'DRAFT') throw Object.assign(new Error('Sale is not in DRAFT status'), { status: 400 });
    if (!sale.items.length) throw Object.assign(new Error('Sale has no items'), { status: 400 });

    // 1. Validate stock for all product-linked items
    for (const item of sale.items) {
      if (item.productId && item.product) {
        if (item.product.quantity < item.quantity) {
          throw Object.assign(
            new Error(`Insufficient stock for "${item.product.name}": need ${item.quantity}, available ${item.product.quantity}`),
            { status: 400 }
          );
        }
      }
    }

    // 2. Deduct inventory for each product item
    for (const item of sale.items) {
      if (item.productId && item.product) {
        const newQty = item.product.quantity - item.quantity;
        await tx.product.update({ where: { id: item.productId }, data: { quantity: newQty } });
        await tx.inventoryTransaction.create({
          data: {
            productId:   item.productId,
            type:        'SALE',
            quantity:    item.quantity,
            balanceAfter: newQty,
            reference:   sale.saleNumber,
            notes:       `Sale ${sale.saleNumber} — ${item.description}`,
            createdBy:   req.user.id,
            warehouseId: sale.warehouseId || req.warehouseId || null,
          },
        });
      }
    }

    // 3. Create invoice as a ClientTransaction
    const invoice = await tx.clientTransaction.create({
      data: {
        clientId:    sale.clientId,
        type:        'INVOICE',
        amount:      sale.totalAmount,
        description: `Invoice for Sale ${sale.saleNumber}`,
        reference:   sale.saleNumber,
        date:        new Date(),
        createdBy:   req.user.id,
        warehouseId: sale.warehouseId || req.warehouseId || null,
      },
    });

    // 4. Update sale to CONFIRMED and link invoice
    const confirmed = await tx.sale.update({
      where: { id },
      data: { status: 'CONFIRMED', invoiceId: invoice.id },
      include: SALE_INCLUDE,
    });

    return confirmed;
  });

  logAudit({ userId: req.user.id, action: 'CONFIRM', module: 'SALES', resourceId: result.id, resourceType: 'Sale', newValues: { saleNumber: result.saleNumber, totalAmount: result.totalAmount }, req });
  res.json(result);
}

async function deliverSale(req, res) {
  const id = Number(req.params.id);
  const sale = await prisma.sale.findUnique({ where: { id } });
  if (!sale) return res.status(404).json({ message: 'Not found' });
  if (sale.status !== 'CONFIRMED') return res.status(400).json({ message: 'Only CONFIRMED sales can be marked delivered' });

  const updated = await prisma.sale.update({
    where: { id },
    data: { status: 'DELIVERED' },
    include: SALE_INCLUDE,
  });
  logAudit({ userId: req.user.id, action: 'DELIVER', module: 'SALES', resourceId: id, resourceType: 'Sale', req });
  res.json(updated);
}

async function cancelSale(req, res) {
  const id = Number(req.params.id);

  const result = await prisma.base.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });

    if (!sale) throw Object.assign(new Error('Not found'), { status: 404 });
    if (sale.status === 'CANCELLED') throw Object.assign(new Error('Already cancelled'), { status: 400 });
    if (sale.status === 'DELIVERED') throw Object.assign(new Error('Delivered sales cannot be cancelled'), { status: 400 });

    // If confirmed, reverse inventory
    if (sale.status === 'CONFIRMED') {
      for (const item of sale.items) {
        if (item.productId && item.product) {
          const restoredQty = item.product.quantity + item.quantity;
          await tx.product.update({ where: { id: item.productId }, data: { quantity: restoredQty } });
          await tx.inventoryTransaction.create({
            data: {
              productId:    item.productId,
              type:         'RETURN',
              quantity:     item.quantity,
              balanceAfter: restoredQty,
              reference:    sale.saleNumber,
              notes:        `Cancelled Sale ${sale.saleNumber} — stock restored`,
              createdBy:    req.user.id,
            },
          });
        }
      }

      // Void the invoice with a credit note
      if (sale.invoiceId) {
        await tx.clientTransaction.create({
          data: {
            clientId:    sale.clientId,
            type:        'CREDIT_NOTE',
            amount:      sale.totalAmount,
            description: `Credit note — Sale ${sale.saleNumber} cancelled`,
            reference:   sale.saleNumber,
            date:        new Date(),
            createdBy:   req.user.id,
            warehouseId: sale.warehouseId || req.warehouseId || null,
          },
        });
      }
    }

    return tx.sale.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: SALE_INCLUDE,
    });
  });

  logAudit({ userId: req.user.id, action: 'CANCEL', module: 'SALES', resourceId: result.id, resourceType: 'Sale', req });
  res.json(result);
}

module.exports = {
  getDashboardStats,
  getSales, getSale, createSale, updateSale, deleteSale,
  confirmSale, deliverSale, cancelSale,
};
