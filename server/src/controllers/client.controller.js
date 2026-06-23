const prisma = require('../utils/prisma');
const { logAudit } = require('./audit.controller');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CLIENT_SELECT = {
  id: true,
  companyName: true,
  industry: true,
  email: true,
  phone: true,
  mobile: true,
  website: true,
  address: true,
  city: true,
  country: true,
  taxNumber: true,
  creditLimit: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  createdByUser: { select: { id: true, fullName: true } },
  contacts: {
    orderBy: [{ isPrimary: 'desc' }, { fullName: 'asc' }],
  },
  clientNotes: {
    include: { user: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'desc' },
  },
  _count: { select: { transactions: true, clientNotes: true } },
};

function calcBalance(transactions) {
  let balance = 0;
  for (const tx of transactions) {
    if (tx.type === 'INVOICE' || tx.type === 'DEBIT_NOTE') balance += tx.amount;
    else balance -= tx.amount;
  }
  return balance;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

async function getStats(req, res) {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [totalClients, activeClients, prospects, newThisMonth, txAgg] = await Promise.all([
    prisma.client.count(),
    prisma.client.count({ where: { status: 'ACTIVE' } }),
    prisma.client.count({ where: { status: 'PROSPECT' } }),
    prisma.client.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.clientTransaction.groupBy({
      by: ['type'],
      _sum: { amount: true },
    }),
  ]);

  const txMap = {};
  for (const row of txAgg) txMap[row.type] = row._sum.amount || 0;
  const totalCharged = (txMap.INVOICE || 0) + (txMap.DEBIT_NOTE || 0);
  const totalPaid    = (txMap.PAYMENT || 0) + (txMap.CREDIT_NOTE || 0);
  const outstanding  = totalCharged - totalPaid;

  const recentClients = await prisma.client.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true, companyName: true, industry: true, status: true, createdAt: true,
      contacts: { where: { isPrimary: true }, take: 1 },
    },
  });

  res.json({ totalClients, activeClients, prospects, newThisMonth, outstanding, recentClients });
}

// ─── Clients CRUD ─────────────────────────────────────────────────────────────

async function getClients(req, res) {
  const { search, status, industry } = req.query;
  const where = {};
  if (status) where.status = status;
  if (industry) where.industry = industry;
  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: 'insensitive' } },
      { email:       { contains: search, mode: 'insensitive' } },
      { phone:       { contains: search, mode: 'insensitive' } },
      { city:        { contains: search, mode: 'insensitive' } },
    ];
  }

  const clients = await prisma.client.findMany({
    where,
    select: {
      id: true, companyName: true, industry: true, email: true, phone: true,
      city: true, country: true, status: true, creditLimit: true, createdAt: true,
      contacts: { where: { isPrimary: true }, take: 1 },
      _count: { select: { transactions: true } },
    },
    orderBy: { companyName: 'asc' },
  });

  // Attach outstanding balance for each client (batch query)
  const clientIds = clients.map((c) => c.id);
  const txRows = await prisma.clientTransaction.groupBy({
    by: ['clientId', 'type'],
    where: { clientId: { in: clientIds } },
    _sum: { amount: true },
  });

  const balanceMap = {};
  for (const row of txRows) {
    if (!balanceMap[row.clientId]) balanceMap[row.clientId] = 0;
    if (row.type === 'INVOICE' || row.type === 'DEBIT_NOTE') balanceMap[row.clientId] += row._sum.amount || 0;
    else balanceMap[row.clientId] -= row._sum.amount || 0;
  }

  const result = clients.map((c) => ({ ...c, outstandingBalance: balanceMap[c.id] || 0 }));
  res.json(result);
}

async function getClient(req, res) {
  const client = await prisma.client.findUnique({
    where: { id: Number(req.params.id) },
    select: CLIENT_SELECT,
  });
  if (!client) return res.status(404).json({ message: 'Client not found' });

  // Balance summary
  const txAgg = await prisma.clientTransaction.groupBy({
    by: ['type'],
    where: { clientId: client.id },
    _sum: { amount: true },
  });
  const txMap = {};
  for (const row of txAgg) txMap[row.type] = row._sum.amount || 0;
  const totalInvoiced = (txMap.INVOICE || 0) + (txMap.DEBIT_NOTE || 0);
  const totalPaid     = (txMap.PAYMENT || 0) + (txMap.CREDIT_NOTE || 0);

  res.json({
    ...client,
    outstandingBalance: totalInvoiced - totalPaid,
    financials: { totalInvoiced, totalPaid, outstandingBalance: totalInvoiced - totalPaid },
  });
}

async function createClient(req, res) {
  const {
    companyName, industry, email, phone, mobile, website,
    address, city, country, taxNumber, creditLimit, status, notes,
    primaryContact,
  } = req.body;

  const client = await prisma.$transaction(async (tx) => {
    const c = await tx.client.create({
      data: {
        companyName, industry, email, phone, mobile, website,
        address, city, country, taxNumber,
        creditLimit: creditLimit ? Number(creditLimit) : null,
        status: status || 'ACTIVE',
        notes,
        createdBy: req.user.id,
      },
    });

    if (primaryContact?.fullName) {
      await tx.contact.create({
        data: {
          clientId: c.id,
          fullName: primaryContact.fullName,
          title: primaryContact.title || null,
          email: primaryContact.email || null,
          phone: primaryContact.phone || null,
          mobile: primaryContact.mobile || null,
          isPrimary: true,
        },
      });
    }

    return tx.client.findUnique({ where: { id: c.id }, select: CLIENT_SELECT });
  });

  logAudit({ userId: req.user.id, action: 'CREATE', module: 'CLIENTS', resourceId: client.id, resourceType: 'Client', newValues: { companyName, industry, status }, req });
  res.status(201).json(client);
}

async function updateClient(req, res) {
  const {
    companyName, industry, email, phone, mobile, website,
    address, city, country, taxNumber, creditLimit, status, notes,
  } = req.body;

  const client = await prisma.client.update({
    where: { id: Number(req.params.id) },
    data: {
      companyName, industry, email, phone, mobile, website,
      address, city, country, taxNumber,
      creditLimit: creditLimit !== undefined ? (creditLimit ? Number(creditLimit) : null) : undefined,
      status, notes,
    },
    select: CLIENT_SELECT,
  });
  logAudit({ userId: req.user.id, action: 'UPDATE', module: 'CLIENTS', resourceId: client.id, resourceType: 'Client', newValues: { companyName, status }, req });
  res.json(client);
}

async function deleteClient(req, res) {
  const id = Number(req.params.id);
  const txCount = await prisma.clientTransaction.count({ where: { clientId: id } });
  if (txCount > 0) {
    await prisma.client.update({ where: { id }, data: { status: 'INACTIVE' } });
    logAudit({ userId: req.user.id, action: 'DEACTIVATE', module: 'CLIENTS', resourceId: id, resourceType: 'Client', req });
    return res.json({ message: 'Client deactivated (has transaction history)' });
  }
  await prisma.client.delete({ where: { id } });
  logAudit({ userId: req.user.id, action: 'DELETE', module: 'CLIENTS', resourceId: id, resourceType: 'Client', req });
  res.json({ message: 'Client deleted' });
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

async function getContacts(req, res) {
  const contacts = await prisma.contact.findMany({
    where: { clientId: Number(req.params.id) },
    orderBy: [{ isPrimary: 'desc' }, { fullName: 'asc' }],
  });
  res.json(contacts);
}

async function getAllContacts(req, res) {
  const { search } = req.query;
  const where = {};
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email:    { contains: search, mode: 'insensitive' } },
      { phone:    { contains: search, mode: 'insensitive' } },
      { client:   { companyName: { contains: search, mode: 'insensitive' } } },
    ];
  }
  const contacts = await prisma.contact.findMany({
    where,
    include: { client: { select: { id: true, companyName: true, status: true } } },
    orderBy: [{ isPrimary: 'desc' }, { fullName: 'asc' }],
  });
  res.json(contacts);
}

async function createContact(req, res) {
  const clientId = Number(req.params.id);
  const { fullName, title, email, phone, mobile, isPrimary } = req.body;

  const contact = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.contact.updateMany({ where: { clientId }, data: { isPrimary: false } });
    }
    return tx.contact.create({
      data: { clientId, fullName, title, email, phone, mobile, isPrimary: !!isPrimary },
    });
  });

  logAudit({ userId: req.user.id, action: 'CREATE', module: 'CLIENTS', resourceId: contact.id, resourceType: 'Contact', newValues: { fullName, clientId }, req });
  res.status(201).json(contact);
}

async function updateContact(req, res) {
  const clientId = Number(req.params.id);
  const contactId = Number(req.params.contactId);
  const { fullName, title, email, phone, mobile, isPrimary } = req.body;

  const contact = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.contact.updateMany({ where: { clientId, id: { not: contactId } }, data: { isPrimary: false } });
    }
    return tx.contact.update({
      where: { id: contactId },
      data: { fullName, title, email, phone, mobile, isPrimary: !!isPrimary },
    });
  });

  logAudit({ userId: req.user.id, action: 'UPDATE', module: 'CLIENTS', resourceId: contact.id, resourceType: 'Contact', newValues: { fullName }, req });
  res.json(contact);
}

async function deleteContact(req, res) {
  await prisma.contact.delete({ where: { id: Number(req.params.contactId) } });
  logAudit({ userId: req.user.id, action: 'DELETE', module: 'CLIENTS', resourceId: Number(req.params.contactId), resourceType: 'Contact', req });
  res.json({ message: 'Contact deleted' });
}

// ─── Notes / Activity ─────────────────────────────────────────────────────────

async function getNotes(req, res) {
  const notes = await prisma.clientNote.findMany({
    where: { clientId: Number(req.params.id) },
    include: { user: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(notes);
}

async function createNote(req, res) {
  const noteText = req.body.content || req.body.note;
  const note = await prisma.clientNote.create({
    data: {
      clientId: Number(req.params.id),
      note: noteText,
      createdBy: req.user.id,
    },
    include: { user: { select: { id: true, fullName: true } } },
  });
  logAudit({ userId: req.user.id, action: 'CREATE', module: 'CLIENTS', resourceId: note.id, resourceType: 'ClientNote', newValues: { clientId: Number(req.params.id) }, req });
  res.status(201).json(note);
}

async function deleteNote(req, res) {
  const note = await prisma.clientNote.findUnique({ where: { id: Number(req.params.noteId) } });
  if (!note) return res.status(404).json({ message: 'Note not found' });
  if (note.createdBy !== req.user.id && !req.user.permissions.includes('CLIENTS_DELETE')) {
    return res.status(403).json({ message: 'Cannot delete another user\'s note' });
  }
  await prisma.clientNote.delete({ where: { id: note.id } });
  logAudit({ userId: req.user.id, action: 'DELETE', module: 'CLIENTS', resourceId: note.id, resourceType: 'ClientNote', req });
  res.json({ message: 'Note deleted' });
}

// ─── Ledger / Transactions ────────────────────────────────────────────────────

async function getLedger(req, res) {
  const clientId = Number(req.params.id);
  const { page = 1, limit = 30 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const [transactions, total] = await Promise.all([
    prisma.clientTransaction.findMany({
      where: { clientId },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { date: 'asc' },
      skip,
      take: Number(limit),
    }),
    prisma.clientTransaction.count({ where: { clientId } }),
  ]);

  // Build running balance
  let runningBalance = 0;
  const ledger = transactions.map((tx) => {
    const isCharge = tx.type === 'INVOICE' || tx.type === 'DEBIT_NOTE';
    if (isCharge) runningBalance += tx.amount;
    else runningBalance -= tx.amount;
    return {
      ...tx,
      debit:   isCharge ? tx.amount : null,
      credit:  isCharge ? null : tx.amount,
      balance: runningBalance,
    };
  });

  res.json({
    transactions: ledger.reverse(),
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    closingBalance: runningBalance,
  });
}

async function createTransaction(req, res) {
  const { type, amount, description, reference, date, dueDate } = req.body;

  const tx = await prisma.clientTransaction.create({
    data: {
      clientId: Number(req.params.id),
      type,
      amount: Number(amount),
      description,
      reference: reference || null,
      date: date ? new Date(date) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      createdBy: req.user.id,
    },
    include: { user: { select: { id: true, fullName: true } } },
  });

  logAudit({ userId: req.user.id, action: 'CREATE', module: 'CLIENTS', resourceId: tx.id, resourceType: 'ClientTransaction', newValues: { type, amount, clientId: Number(req.params.id) }, req });
  res.status(201).json(tx);
}

async function deleteTransaction(req, res) {
  await prisma.clientTransaction.delete({ where: { id: Number(req.params.txId) } });
  logAudit({ userId: req.user.id, action: 'DELETE', module: 'CLIENTS', resourceId: Number(req.params.txId), resourceType: 'ClientTransaction', req });
  res.json({ message: 'Transaction deleted' });
}

// ─── Item history (products this client has purchased via sales) ───────────────

async function getClientItems(req, res) {
  const clientId = Number(req.params.id);

  const items = await prisma.saleItem.findMany({
    where: { sale: { clientId } },
    include: {
      product: { select: { id: true, sku: true, name: true, unitType: true } },
      sale: { select: { id: true, saleNumber: true, saleDate: true, status: true } },
    },
    orderBy: { sale: { saleDate: 'desc' } },
  });

  // Per-line history
  const history = items.map((it) => ({
    id: it.id,
    productId: it.productId,
    sku: it.product?.sku || null,
    name: it.product?.name || it.description,
    unitType: it.product?.unitType || null,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    total: it.total,
    saleNumber: it.sale?.saleNumber,
    saleId: it.sale?.id,
    saleDate: it.sale?.saleDate,
    saleStatus: it.sale?.status,
  }));

  // Aggregate totals per product
  const byProduct = {};
  for (const h of history) {
    const key = h.productId || `desc:${h.name}`;
    if (!byProduct[key]) {
      byProduct[key] = { productId: h.productId, sku: h.sku, name: h.name, unitType: h.unitType, totalQuantity: 0, totalSpent: 0, orders: 0 };
    }
    byProduct[key].totalQuantity += h.quantity;
    byProduct[key].totalSpent += h.total;
    byProduct[key].orders += 1;
  }

  res.json({ history, summary: Object.values(byProduct).sort((a, b) => b.totalSpent - a.totalSpent) });
}

// ─── Industries list ──────────────────────────────────────────────────────────

async function getIndustries(req, res) {
  const rows = await prisma.client.groupBy({
    by: ['industry'],
    where: { industry: { not: null } },
    _count: true,
    orderBy: { _count: { industry: 'desc' } },
  });
  res.json(rows.map((r) => r.industry).filter(Boolean));
}

module.exports = {
  getStats,
  getClients, getClient, createClient, updateClient, deleteClient,
  getContacts, getAllContacts, createContact, updateContact, deleteContact,
  getNotes, createNote, deleteNote,
  getLedger, createTransaction, deleteTransaction,
  getClientItems,
  getIndustries,
};
