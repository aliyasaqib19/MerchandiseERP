const prisma = require('../utils/prisma');
const { generateDocNumber } = require('../utils/numberGen');

const PO_INCLUDE = {
  client:        { select: { id: true, companyName: true, email: true, address: true, city: true, country: true } },
  quotation:     { select: { id: true, quotationNumber: true } },
  createdByUser: { select: { id: true, fullName: true } },
  items: {
    include: { product: { select: { id: true, name: true, sku: true, unitType: true } } },
    orderBy: { id: 'asc' },
  },
};

function computeTotals(items, taxRate) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
  const taxAmount = subtotal * (Number(taxRate) || 0) / 100;
  return { subtotal, taxAmount, totalAmount: subtotal + taxAmount };
}

async function getPurchaseOrders(req, res) {
  const { search, status, clientId, page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const where = {};

  if (status) where.status = status;
  if (clientId) where.clientId = Number(clientId);
  if (search) {
    where.OR = [
      { poNumber: { contains: search, mode: 'insensitive' } },
      { client: { companyName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [purchaseOrders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        client:    { select: { id: true, companyName: true } },
        quotation: { select: { id: true, quotationNumber: true } },
        createdByUser: { select: { fullName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  res.json({ purchaseOrders, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
}

async function getPurchaseOrder(req, res) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: Number(req.params.id) },
    include: PO_INCLUDE,
  });
  if (!po) return res.status(404).json({ message: 'Purchase Order not found' });
  res.json(po);
}

async function createPurchaseOrder(req, res) {
  const { clientId, quotationId, poDate, expectedDelivery, notes, taxRate = 0, items = [] } = req.body;

  const poNumber = await generateDocNumber('purchaseOrder', 'poNumber', 'PO');
  const { subtotal, taxAmount, totalAmount } = computeTotals(items, taxRate);

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      clientId:        Number(clientId),
      quotationId:     quotationId ? Number(quotationId) : null,
      createdBy:       req.user.id,
      notes,
      taxRate:         Number(taxRate),
      taxAmount,
      subtotal,
      totalAmount,
      poDate:          poDate ? new Date(poDate) : new Date(),
      expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null,
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
    include: PO_INCLUDE,
  });

  res.status(201).json(po);
}

async function updatePurchaseOrder(req, res) {
  const id = Number(req.params.id);
  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Not found' });
  if (existing.status !== 'PENDING') return res.status(400).json({ message: 'Only PENDING POs can be edited' });

  const { clientId, quotationId, poDate, expectedDelivery, notes, taxRate = 0, items = [] } = req.body;
  const { subtotal, taxAmount, totalAmount } = computeTotals(items, taxRate);

  const po = await prisma.$transaction(async (tx) => {
    await tx.pOItem.deleteMany({ where: { poId: id } });
    return tx.purchaseOrder.update({
      where: { id },
      data: {
        clientId:        Number(clientId),
        quotationId:     quotationId ? Number(quotationId) : null,
        notes,
        taxRate:         Number(taxRate),
        taxAmount,
        subtotal,
        totalAmount,
        poDate:          poDate ? new Date(poDate) : undefined,
        expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null,
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
      include: PO_INCLUDE,
    });
  });

  res.json(po);
}

async function updateStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  const VALID = {
    PENDING:   ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED:  ['CANCELLED'],
    REJECTED:  [],
    CANCELLED: [],
  };

  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) return res.status(404).json({ message: 'Not found' });
  if (!VALID[po.status]?.includes(status)) {
    return res.status(400).json({ message: `Cannot transition from ${po.status} to ${status}` });
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: { status },
    include: PO_INCLUDE,
  });
  res.json(updated);
}

async function convertToSale(req, res) {
  const id = Number(req.params.id);
  const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
  if (!po) return res.status(404).json({ message: 'Not found' });
  if (po.status !== 'APPROVED') return res.status(400).json({ message: 'Only APPROVED POs can be converted to a sale' });

  const saleNumber = await generateDocNumber('sale', 'saleNumber', 'SALE');

  const sale = await prisma.sale.create({
    data: {
      saleNumber,
      clientId:   po.clientId,
      quotationId: po.quotationId,
      poId:       po.id,
      createdBy:  req.user.id,
      notes:      po.notes,
      subtotal:   po.subtotal,
      taxRate:    po.taxRate,
      taxAmount:  po.taxAmount,
      totalAmount: po.totalAmount,
      items: {
        create: po.items.map((item) => ({
          productId:   item.productId,
          description: item.description,
          quantity:    item.quantity,
          unitPrice:   item.unitPrice,
          total:       item.total,
          costPrice:   0,
        })),
      },
    },
    include: {
      client: { select: { id: true, companyName: true } },
      items: true,
    },
  });

  res.status(201).json(sale);
}

module.exports = {
  getPurchaseOrders, getPurchaseOrder, createPurchaseOrder, updatePurchaseOrder,
  updateStatus, convertToSale,
};
