const prisma = require('../utils/prisma');

const today = () => new Date();

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// Compute outstanding balance from grouped transaction rows
function buildBalanceMap(txRows) {
  const map = {};
  for (const row of txRows) {
    if (!map[row.clientId]) map[row.clientId] = 0;
    const isCharge = row.type === 'INVOICE' || row.type === 'DEBIT_NOTE';
    map[row.clientId] += isCharge ? (row._sum.amount || 0) : -(row._sum.amount || 0);
  }
  return map;
}

function agingBucket(daysOverdue) {
  if (daysOverdue <= 0)   return 'current';
  if (daysOverdue <= 30)  return '1_30';
  if (daysOverdue <= 60)  return '31_60';
  if (daysOverdue <= 90)  return '61_90';
  return '90_plus';
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

async function getStats(req, res) {
  const som = startOfMonth();
  const now = today();

  const [allTxAgg, thisMonthAgg, overdueCount, overdueAmount] = await Promise.all([
    // All-time grouped totals for total receivables
    prisma.clientTransaction.groupBy({
      by: ['type'],
      _sum: { amount: true },
    }),
    // This month payments + invoices
    prisma.clientTransaction.groupBy({
      by: ['type'],
      where: { createdAt: { gte: som } },
      _sum: { amount: true },
    }),
    // Count overdue invoices (dueDate in the past)
    prisma.clientTransaction.count({
      where: { type: 'INVOICE', dueDate: { lt: now, not: null } },
    }),
    // Sum of overdue invoice amounts
    prisma.clientTransaction.aggregate({
      where: { type: 'INVOICE', dueDate: { lt: now, not: null } },
      _sum: { amount: true },
    }),
  ]);

  const allMap   = Object.fromEntries(allTxAgg.map((r) => [r.type, r._sum.amount || 0]));
  const momMap   = Object.fromEntries(thisMonthAgg.map((r) => [r.type, r._sum.amount || 0]));

  const totalCharged = (allMap.INVOICE || 0) + (allMap.DEBIT_NOTE || 0);
  const totalPaid    = (allMap.PAYMENT || 0) + (allMap.CREDIT_NOTE || 0);
  const totalReceivables = Math.max(0, totalCharged - totalPaid);

  // Recent payments
  const recentPayments = await prisma.clientTransaction.findMany({
    where: { type: { in: ['PAYMENT', 'CREDIT_NOTE'] } },
    include: { client: { select: { id: true, companyName: true } } },
    orderBy: { date: 'desc' },
    take: 8,
  });

  res.json({
    totalReceivables,
    overdueCount,
    overdueAmount: overdueAmount._sum.amount || 0,
    collectedThisMonth:  momMap.PAYMENT    || 0,
    invoicedThisMonth:   momMap.INVOICE    || 0,
    recentPayments,
  });
}

// ─── Invoice List ─────────────────────────────────────────────────────────────

async function getInvoices(req, res) {
  const { clientId, status, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const now  = today();

  const where = { type: 'INVOICE' };
  if (clientId) where.clientId = Number(clientId);
  if (dateFrom) where.date = { ...where.date, gte: new Date(dateFrom) };
  if (dateTo)   where.date = { ...where.date, lte: new Date(dateTo) };
  if (status === 'overdue')  where.dueDate = { lt: now, not: null };
  if (status === 'no_due')   where.dueDate = null;

  const [invoices, total] = await Promise.all([
    prisma.clientTransaction.findMany({
      where,
      include: {
        client: { select: { id: true, companyName: true, email: true } },
        user:   { select: { fullName: true } },
        sale:   { select: { id: true, saleNumber: true } },
      },
      orderBy: { date: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.clientTransaction.count({ where }),
  ]);

  // Fetch outstanding balances for the clients in this page
  const clientIds = [...new Set(invoices.map((i) => i.clientId))];
  const txRows = await prisma.clientTransaction.groupBy({
    by: ['clientId', 'type'],
    where: { clientId: { in: clientIds } },
    _sum: { amount: true },
  });
  const balanceMap = buildBalanceMap(txRows);

  const result = invoices.map((inv) => {
    const daysOverdue = inv.dueDate
      ? Math.max(0, Math.floor((now - new Date(inv.dueDate)) / 86400000))
      : 0;
    return {
      ...inv,
      isOverdue:      inv.dueDate ? new Date(inv.dueDate) < now : false,
      daysOverdue,
      clientBalance:  balanceMap[inv.clientId] || 0,
    };
  });

  res.json({ invoices: result, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
}

// ─── Payment History ──────────────────────────────────────────────────────────

async function getPayments(req, res) {
  const { clientId, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where = { type: { in: ['PAYMENT', 'CREDIT_NOTE'] } };
  if (clientId) where.clientId = Number(clientId);
  if (dateFrom) where.date = { ...where.date, gte: new Date(dateFrom) };
  if (dateTo)   where.date = { ...where.date, lte: new Date(dateTo) };

  const [payments, total] = await Promise.all([
    prisma.clientTransaction.findMany({
      where,
      include: {
        client: { select: { id: true, companyName: true } },
        user:   { select: { fullName: true } },
      },
      orderBy: { date: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.clientTransaction.count({ where }),
  ]);

  res.json({ payments, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
}

// ─── Record Payment ───────────────────────────────────────────────────────────

async function recordPayment(req, res) {
  const { clientId, amount, description, reference, paymentMethod, date } = req.body;

  // Verify client exists
  const client = await prisma.client.findUnique({ where: { id: Number(clientId) } });
  if (!client) return res.status(404).json({ message: 'Client not found' });

  const payment = await prisma.clientTransaction.create({
    data: {
      clientId:      Number(clientId),
      type:          'PAYMENT',
      amount:        Number(amount),
      description:   description || `Payment received`,
      reference:     reference || null,
      paymentMethod: paymentMethod || null,
      date:          date ? new Date(date) : new Date(),
      createdBy:     req.user.id,
    },
    include: {
      client: { select: { id: true, companyName: true } },
      user:   { select: { fullName: true } },
    },
  });

  res.status(201).json(payment);
}

// ─── Outstanding Clients ──────────────────────────────────────────────────────

async function getOutstanding(req, res) {
  const now = today();

  // Step 1: get all transaction sums grouped by clientId + type
  const txRows = await prisma.clientTransaction.groupBy({
    by: ['clientId', 'type'],
    _sum: { amount: true },
  });

  const balanceMap = buildBalanceMap(txRows);

  // Only clients with positive balance
  const clientIds = Object.entries(balanceMap)
    .filter(([, bal]) => bal > 0.01)
    .map(([id]) => Number(id));

  if (clientIds.length === 0) return res.json([]);

  const [clients, oldestOverdueInvoices] = await Promise.all([
    prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, companyName: true, email: true, phone: true, status: true, creditLimit: true },
    }),
    // Oldest overdue invoice per client
    prisma.clientTransaction.findMany({
      where: {
        clientId: { in: clientIds },
        type:     'INVOICE',
        dueDate:  { lt: now, not: null },
      },
      orderBy: { dueDate: 'asc' },
    }),
  ]);

  // Map oldest overdue per client
  const oldestMap = {};
  for (const inv of oldestOverdueInvoices) {
    if (!oldestMap[inv.clientId]) oldestMap[inv.clientId] = inv;
  }

  const result = clients.map((c) => {
    const balance      = balanceMap[c.id] || 0;
    const oldest       = oldestMap[c.id];
    const daysOverdue  = oldest
      ? Math.max(0, Math.floor((now - new Date(oldest.dueDate)) / 86400000))
      : 0;
    const bucket       = agingBucket(daysOverdue);

    return {
      ...c,
      outstandingBalance: balance,
      daysOverdue,
      oldestDueDate: oldest?.dueDate || null,
      agingBucket:   bucket,
      isOverdue:     daysOverdue > 0,
    };
  });

  result.sort((a, b) => b.outstandingBalance - a.outstandingBalance);
  res.json(result);
}

// ─── Aged Receivables Report ──────────────────────────────────────────────────

async function getAgedReceivables(req, res) {
  const now = today();

  // All transaction sums
  const txRows = await prisma.clientTransaction.groupBy({
    by: ['clientId', 'type'],
    _sum: { amount: true },
  });
  const balanceMap = buildBalanceMap(txRows);
  const clientIds  = Object.keys(balanceMap).map(Number).filter((id) => balanceMap[id] > 0.01);

  if (clientIds.length === 0) {
    return res.json({ summary: { current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0, total: 0 }, clients: [] });
  }

  const [clients, allInvoices] = await Promise.all([
    prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, companyName: true, status: true },
    }),
    prisma.clientTransaction.findMany({
      where: { clientId: { in: clientIds }, type: 'INVOICE' },
      orderBy: [{ clientId: 'asc' }, { dueDate: 'asc' }],
    }),
  ]);

  // For each client, distribute outstanding balance across aging buckets
  // Strategy: FIFO — oldest invoices are considered unpaid first
  const clientRows = clients.map((client) => {
    const outstanding  = balanceMap[client.id] || 0;
    const myInvoices   = allInvoices.filter((i) => i.clientId === client.id);

    const buckets = { current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0 };
    let remaining = outstanding;

    // Sort oldest first; distribute remaining balance into buckets
    const sorted = [...myInvoices].sort((a, b) => {
      const da = a.dueDate ? new Date(a.dueDate) : new Date(a.date);
      const db = b.dueDate ? new Date(b.dueDate) : new Date(b.date);
      return da - db;
    });

    for (const inv of sorted) {
      if (remaining <= 0) break;
      const refDate    = inv.dueDate ? new Date(inv.dueDate) : new Date(inv.date);
      const days       = Math.floor((now - refDate) / 86400000);
      const bucket     = agingBucket(days);
      const allocated  = Math.min(remaining, inv.amount);
      buckets[bucket] += allocated;
      remaining        -= allocated;
    }

    // Any remaining balance with no matching invoice → current
    if (remaining > 0) buckets.current += remaining;

    return { ...client, outstandingBalance: outstanding, buckets };
  });

  // Summary totals
  const summary = clientRows.reduce(
    (acc, c) => {
      for (const k of Object.keys(acc)) {
        if (k !== 'total') acc[k] += c.buckets[k] || 0;
      }
      acc.total += c.outstandingBalance;
      return acc;
    },
    { current: 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0, total: 0 }
  );

  clientRows.sort((a, b) => b.outstandingBalance - a.outstandingBalance);
  res.json({ summary, clients: clientRows });
}

// ─── Client Balance Detail ────────────────────────────────────────────────────

async function getClientBalance(req, res) {
  const clientId = Number(req.params.clientId);
  const now = today();

  const [client, transactions] = await Promise.all([
    prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, companyName: true, creditLimit: true, status: true },
    }),
    prisma.clientTransaction.findMany({
      where: { clientId },
      include: { user: { select: { fullName: true } } },
      orderBy: { date: 'asc' },
    }),
  ]);

  if (!client) return res.status(404).json({ message: 'Client not found' });

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
      isOverdue: tx.type === 'INVOICE' && tx.dueDate ? new Date(tx.dueDate) < now : false,
      daysOverdue: tx.type === 'INVOICE' && tx.dueDate
        ? Math.max(0, Math.floor((now - new Date(tx.dueDate)) / 86400000))
        : 0,
    };
  });

  res.json({ client, outstandingBalance: runningBalance, ledger: ledger.reverse() });
}

module.exports = {
  getStats, getInvoices, getPayments, recordPayment,
  getOutstanding, getAgedReceivables, getClientBalance,
};
