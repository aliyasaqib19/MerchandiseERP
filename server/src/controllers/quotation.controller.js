const prisma = require('../utils/prisma');
const { generateDocNumber } = require('../utils/numberGen');

const QUOTATION_INCLUDE = {
  client:        { select: { id: true, companyName: true, email: true, taxNumber: true, address: true, city: true, country: true } },
  createdByUser: { select: { id: true, fullName: true } },
  items: {
    include: { product: { select: { id: true, name: true, sku: true, unitType: true } } },
    orderBy: { id: 'asc' },
  },
};

function computeTotals(items, discountType, discountValue, taxRate) {
  const subtotal = items.reduce((sum, item) => {
    return sum + (Number(item.quantity) * Number(item.unitPrice) * (1 - (Number(item.discount) || 0) / 100));
  }, 0);

  const discountAmount = discountType === 'PERCENTAGE'
    ? subtotal * (Number(discountValue) || 0) / 100
    : (Number(discountValue) || 0);

  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (Number(taxRate) || 0) / 100;
  const totalAmount = taxableAmount + taxAmount;

  return { subtotal, discountAmount, taxAmount, totalAmount };
}

async function getStats(req, res) {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [total, draft, sent, approved, thisMonth] = await Promise.all([
    prisma.quotation.count(),
    prisma.quotation.count({ where: { status: 'DRAFT' } }),
    prisma.quotation.count({ where: { status: 'SENT' } }),
    prisma.quotation.count({ where: { status: 'APPROVED' } }),
    prisma.quotation.count({ where: { createdAt: { gte: startOfMonth } } }),
  ]);
  res.json({ total, draft, sent, approved, thisMonth });
}

async function getQuotations(req, res) {
  const { search, status, clientId, page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const where = {};

  if (status) where.status = status;
  if (clientId) where.clientId = Number(clientId);
  if (search) {
    where.OR = [
      { quotationNumber: { contains: search, mode: 'insensitive' } },
      { client: { companyName: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [quotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      include: {
        client: { select: { id: true, companyName: true } },
        createdByUser: { select: { fullName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.quotation.count({ where }),
  ]);

  res.json({ quotations, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
}

async function getQuotation(req, res) {
  const q = await prisma.quotation.findUnique({
    where: { id: Number(req.params.id) },
    include: QUOTATION_INCLUDE,
  });
  if (!q) return res.status(404).json({ message: 'Quotation not found' });
  res.json(q);
}

async function createQuotation(req, res) {
  const {
    clientId, validUntil, notes, terms,
    discountType = 'PERCENTAGE', discountValue = 0, taxRate = 0,
    items = [],
  } = req.body;

  const quotationNumber = await generateDocNumber('quotation', 'quotationNumber', 'QUO');
  const { subtotal, discountAmount, taxAmount, totalAmount } = computeTotals(items, discountType, discountValue, taxRate);

  const quotation = await prisma.quotation.create({
    data: {
      quotationNumber,
      clientId: Number(clientId),
      createdBy: req.user.id,
      validUntil: validUntil ? new Date(validUntil) : null,
      notes, terms,
      discountType, discountValue: Number(discountValue), discountAmount,
      taxRate: Number(taxRate), taxAmount,
      subtotal, totalAmount,
      items: {
        create: items.map((item) => ({
          productId:   item.productId ? Number(item.productId) : null,
          description: item.description,
          quantity:    Number(item.quantity),
          unitPrice:   Number(item.unitPrice),
          discount:    Number(item.discount) || 0,
          total:       Number(item.quantity) * Number(item.unitPrice) * (1 - (Number(item.discount) || 0) / 100),
        })),
      },
    },
    include: QUOTATION_INCLUDE,
  });

  res.status(201).json(quotation);
}

async function updateQuotation(req, res) {
  const id = Number(req.params.id);
  const existing = await prisma.quotation.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Quotation not found' });
  if (existing.status !== 'DRAFT') return res.status(400).json({ message: 'Only DRAFT quotations can be edited' });

  const {
    clientId, validUntil, notes, terms,
    discountType = existing.discountType, discountValue = existing.discountValue, taxRate = existing.taxRate,
    items = [],
  } = req.body;

  const { subtotal, discountAmount, taxAmount, totalAmount } = computeTotals(items, discountType, discountValue, taxRate);

  const quotation = await prisma.$transaction(async (tx) => {
    await tx.quotationItem.deleteMany({ where: { quotationId: id } });
    return tx.quotation.update({
      where: { id },
      data: {
        clientId: Number(clientId),
        validUntil: validUntil ? new Date(validUntil) : null,
        notes, terms,
        discountType, discountValue: Number(discountValue), discountAmount,
        taxRate: Number(taxRate), taxAmount,
        subtotal, totalAmount,
        items: {
          create: items.map((item) => ({
            productId:   item.productId ? Number(item.productId) : null,
            description: item.description,
            quantity:    Number(item.quantity),
            unitPrice:   Number(item.unitPrice),
            discount:    Number(item.discount) || 0,
            total:       Number(item.quantity) * Number(item.unitPrice) * (1 - (Number(item.discount) || 0) / 100),
          })),
        },
      },
      include: QUOTATION_INCLUDE,
    });
  });

  res.json(quotation);
}

async function deleteQuotation(req, res) {
  const id = Number(req.params.id);
  const q = await prisma.quotation.findUnique({ where: { id } });
  if (!q) return res.status(404).json({ message: 'Not found' });
  if (q.status !== 'DRAFT') return res.status(400).json({ message: 'Only DRAFT quotations can be deleted' });
  await prisma.quotation.delete({ where: { id } });
  res.json({ message: 'Quotation deleted' });
}

async function updateStatus(req, res) {
  const id = Number(req.params.id);
  const { status } = req.body;

  const VALID_TRANSITIONS = {
    DRAFT:    ['SENT'],
    SENT:     ['APPROVED', 'REJECTED'],
    APPROVED: ['EXPIRED'],
    REJECTED: [],
    EXPIRED:  [],
  };

  const q = await prisma.quotation.findUnique({ where: { id } });
  if (!q) return res.status(404).json({ message: 'Not found' });

  if (!VALID_TRANSITIONS[q.status]?.includes(status)) {
    return res.status(400).json({ message: `Cannot transition from ${q.status} to ${status}` });
  }

  const updated = await prisma.quotation.update({
    where: { id },
    data: { status },
    include: QUOTATION_INCLUDE,
  });
  res.json(updated);
}

async function convertToSale(req, res) {
  const id = Number(req.params.id);
  const q = await prisma.quotation.findUnique({ where: { id }, include: { items: true } });
  if (!q) return res.status(404).json({ message: 'Not found' });
  if (q.status !== 'APPROVED') return res.status(400).json({ message: 'Only APPROVED quotations can be converted to a sale' });

  const saleNumber = await generateDocNumber('sale', 'saleNumber', 'SALE');

  const sale = await prisma.sale.create({
    data: {
      saleNumber,
      clientId:      q.clientId,
      quotationId:   q.id,
      createdBy:     req.user.id,
      notes:         q.notes,
      subtotal:      q.subtotal,
      discountAmount: q.discountAmount,
      taxRate:       q.taxRate,
      taxAmount:     q.taxAmount,
      totalAmount:   q.totalAmount,
      items: {
        create: q.items.map((item) => ({
          productId:   item.productId,
          description: item.description,
          quantity:    item.quantity,
          unitPrice:   item.unitPrice,
          discount:    item.discount,
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
  getStats, getQuotations, getQuotation, createQuotation, updateQuotation, deleteQuotation,
  updateStatus, convertToSale,
};
