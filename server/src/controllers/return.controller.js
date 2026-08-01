const prisma = require('../utils/prisma');
const { generateDocNumber } = require('../utils/numberGen');
const { logAudit } = require('./audit.controller');

const RETURN_INCLUDE = {
  client:        { select: { id: true, companyName: true } },
  sale:          { select: { id: true, saleNumber: true } },
  createdByUser: { select: { id: true, fullName: true } },
  creditNote:    { select: { id: true, amount: true, date: true, reference: true } },
  items: {
    include: { product: { select: { id: true, name: true, sku: true, unitType: true, quantity: true } } },
    orderBy: { id: 'asc' },
  },
};

function computeTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
  return { subtotal, totalAmount: subtotal };
}

async function getReturns(req, res) {
  const { search, clientId, page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const where = {};

  if (clientId) where.clientId = Number(clientId);
  if (req.warehouseId) where.warehouseId = req.warehouseId;
  if (search) {
    where.OR = [
      { returnNumber: { contains: search, mode: 'insensitive' } },
      { client: { companyName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [returns, total] = await Promise.all([
    prisma.base.salesReturn.findMany({
      where,
      include: {
        client: { select: { id: true, companyName: true } },
        sale:   { select: { saleNumber: true } },
        createdByUser: { select: { fullName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.base.salesReturn.count({ where }),
  ]);

  res.json({ returns, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
}

async function getReturn(req, res) {
  const ret = await prisma.salesReturn.findUnique({
    where: { id: Number(req.params.id) },
    include: RETURN_INCLUDE,
  });
  if (!ret) return res.status(404).json({ message: 'Return not found' });
  res.json(ret);
}

async function createReturn(req, res) {
  const { clientId, saleId, reason, notes, returnDate, items = [] } = req.body;

  const result = await prisma.base.$transaction(async (tx) => {
    const returnNumber = await generateDocNumber('salesReturn', 'returnNumber', 'RET');
    const { subtotal, totalAmount } = computeTotals(items);

    const created = await tx.salesReturn.create({
      data: {
        returnNumber,
        clientId:   Number(clientId),
        saleId:     saleId ? Number(saleId) : null,
        createdBy:  req.user.id,
        reason:     reason || null,
        notes:      notes || null,
        subtotal, totalAmount,
        returnDate: returnDate ? new Date(returnDate) : new Date(),
        warehouseId: req.warehouseId || null,
        items: {
          create: items.map((item) => ({
            productId:   item.productId ? Number(item.productId) : null,
            description: item.description,
            quantity:    Number(item.quantity),
            unitPrice:   Number(item.unitPrice),
            total:       Number(item.quantity) * Number(item.unitPrice),
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });

    // Restore inventory for product-linked items
    for (const item of created.items) {
      if (item.productId && item.product) {
        const newQty = item.product.quantity + item.quantity;
        await tx.product.update({ where: { id: item.productId }, data: { quantity: newQty } });
        await tx.inventoryTransaction.create({
          data: {
            productId:    item.productId,
            type:         'RETURN',
            quantity:     item.quantity,
            balanceAfter: newQty,
            reference:    created.returnNumber,
            notes:        `Return ${created.returnNumber} — ${item.description}`,
            createdBy:    req.user.id,
            warehouseId:  req.warehouseId || null,
          },
        });
      }
    }

    // Issue a credit note to the client
    const creditNote = await tx.clientTransaction.create({
      data: {
        clientId:    Number(clientId),
        type:        'CREDIT_NOTE',
        amount:      totalAmount,
        description: `Credit note — Return ${created.returnNumber}`,
        reference:   created.returnNumber,
        date:        new Date(),
        createdBy:   req.user.id,
        warehouseId: req.warehouseId || null,
      },
    });

    return tx.salesReturn.update({
      where: { id: created.id },
      data: { creditNoteId: creditNote.id },
      include: RETURN_INCLUDE,
    });
  });

  logAudit({ userId: req.user.id, action: 'CREATE', module: 'SALES', resourceId: result.id, resourceType: 'SalesReturn', newValues: { returnNumber: result.returnNumber, clientId, totalAmount: result.totalAmount }, req });
  res.status(201).json(result);
}

async function deleteReturn(req, res) {
  const id = Number(req.params.id);

  await prisma.base.$transaction(async (tx) => {
    const ret = await tx.salesReturn.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (!ret) throw Object.assign(new Error('Not found'), { status: 404 });

    // Reverse: deduct back the inventory that was restored
    for (const item of ret.items) {
      if (item.productId && item.product) {
        const newQty = item.product.quantity - item.quantity;
        await tx.product.update({ where: { id: item.productId }, data: { quantity: newQty } });
        await tx.inventoryTransaction.create({
          data: {
            productId:    item.productId,
            type:         'ADJUSTMENT',
            quantity:     item.quantity,
            balanceAfter: newQty,
            reference:    ret.returnNumber,
            notes:        `Return ${ret.returnNumber} removed — stock adjustment reversed`,
            createdBy:    req.user.id,
          },
        });
      }
    }

    if (ret.creditNoteId) {
      await tx.salesReturn.update({ where: { id }, data: { creditNoteId: null } });
      await tx.clientTransaction.delete({ where: { id: ret.creditNoteId } });
    }

    await tx.salesReturnItem.deleteMany({ where: { returnId: id } });
    await tx.salesReturn.delete({ where: { id } });
  });

  logAudit({ userId: req.user.id, action: 'DELETE', module: 'SALES', resourceId: id, resourceType: 'SalesReturn', req });
  res.json({ message: 'Return removed' });
}

module.exports = { getReturns, getReturn, createReturn, deleteReturn };
