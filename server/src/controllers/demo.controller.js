const prisma = require('../utils/prisma');
const { generateDocNumber } = require('../utils/numberGen');
const { logAudit } = require('./audit.controller');

const DEMO_INCLUDE = {
  client:        { select: { id: true, companyName: true } },
  product:       { select: { id: true, name: true, sku: true, unitType: true, quantity: true } },
  createdByUser: { select: { id: true, fullName: true } },
};

async function getDemoItems(req, res) {
  const { search, status, clientId, page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const where = {};

  if (status) where.status = status;
  if (clientId) where.clientId = Number(clientId);
  if (req.warehouseId) where.warehouseId = req.warehouseId;
  if (search) {
    where.OR = [
      { demoNumber: { contains: search, mode: 'insensitive' } },
      { client: { companyName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [demos, total] = await Promise.all([
    prisma.base.demoItem.findMany({
      where,
      include: DEMO_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.base.demoItem.count({ where }),
  ]);

  res.json({ demos, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
}

async function getDemoItem(req, res) {
  const demo = await prisma.demoItem.findUnique({
    where: { id: Number(req.params.id) },
    include: DEMO_INCLUDE,
  });
  if (!demo) return res.status(404).json({ message: 'Demo item not found' });
  res.json(demo);
}

async function createDemoItem(req, res) {
  const { clientId, productId, quantity, dateOut, expectedReturnDate, notes } = req.body;

  const result = await prisma.base.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: Number(productId) } });
    if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });
    if (product.quantity < Number(quantity)) {
      throw Object.assign(new Error(`Insufficient stock for "${product.name}": need ${quantity}, available ${product.quantity}`), { status: 400 });
    }

    const demoNumber = await generateDocNumber('demoItem', 'demoNumber', 'DEMO');
    const newQty = product.quantity - Number(quantity);

    const demo = await tx.demoItem.create({
      data: {
        demoNumber,
        clientId:  Number(clientId),
        productId: Number(productId),
        quantity:  Number(quantity),
        status:    'OUT',
        dateOut:   dateOut ? new Date(dateOut) : new Date(),
        expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : null,
        notes:     notes || null,
        createdBy: req.user.id,
        warehouseId: req.warehouseId || null,
      },
      include: DEMO_INCLUDE,
    });

    await tx.product.update({ where: { id: Number(productId) }, data: { quantity: newQty } });
    await tx.inventoryTransaction.create({
      data: {
        productId:    Number(productId),
        type:         'STOCK_OUT',
        quantity:     Number(quantity),
        balanceAfter: newQty,
        reference:    demoNumber,
        notes:        `Demo unit out — ${demoNumber}`,
        createdBy:    req.user.id,
        warehouseId:  req.warehouseId || null,
      },
    });

    return demo;
  });

  logAudit({ userId: req.user.id, action: 'CREATE', module: 'SALES', resourceId: result.id, resourceType: 'DemoItem', newValues: { demoNumber: result.demoNumber, clientId, productId }, req });
  res.status(201).json(result);
}

async function markReturned(req, res) {
  const id = Number(req.params.id);

  const result = await prisma.base.$transaction(async (tx) => {
    const demo = await tx.demoItem.findUnique({ where: { id }, include: { product: true } });
    if (!demo) throw Object.assign(new Error('Not found'), { status: 404 });
    if (demo.status !== 'OUT') throw Object.assign(new Error('Only OUT demo items can be marked returned'), { status: 400 });

    const newQty = demo.product.quantity + demo.quantity;
    await tx.product.update({ where: { id: demo.productId }, data: { quantity: newQty } });
    await tx.inventoryTransaction.create({
      data: {
        productId:    demo.productId,
        type:         'RETURN',
        quantity:     demo.quantity,
        balanceAfter: newQty,
        reference:    demo.demoNumber,
        notes:        `Demo unit returned — ${demo.demoNumber}`,
        createdBy:    req.user.id,
        warehouseId:  req.warehouseId || null,
      },
    });

    return tx.demoItem.update({
      where: { id },
      data: { status: 'RETURNED', returnedAt: new Date() },
      include: DEMO_INCLUDE,
    });
  });

  logAudit({ userId: req.user.id, action: 'UPDATE', module: 'SALES', resourceId: id, resourceType: 'DemoItem', req });
  res.json(result);
}

async function deleteDemoItem(req, res) {
  const id = Number(req.params.id);

  await prisma.base.$transaction(async (tx) => {
    const demo = await tx.demoItem.findUnique({ where: { id }, include: { product: true } });
    if (!demo) throw Object.assign(new Error('Not found'), { status: 404 });

    if (demo.status === 'OUT') {
      const newQty = demo.product.quantity + demo.quantity;
      await tx.product.update({ where: { id: demo.productId }, data: { quantity: newQty } });
      await tx.inventoryTransaction.create({
        data: {
          productId:    demo.productId,
          type:         'RETURN',
          quantity:     demo.quantity,
          balanceAfter: newQty,
          reference:    demo.demoNumber,
          notes:        `Demo record removed — stock restored (${demo.demoNumber})`,
          createdBy:    req.user.id,
          warehouseId:  req.warehouseId || null,
        },
      });
    }

    await tx.demoItem.delete({ where: { id } });
  });

  logAudit({ userId: req.user.id, action: 'DELETE', module: 'SALES', resourceId: id, resourceType: 'DemoItem', req });
  res.json({ message: 'Demo item removed' });
}

module.exports = { getDemoItems, getDemoItem, createDemoItem, markReturned, deleteDemoItem };
