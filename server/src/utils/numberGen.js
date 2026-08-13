const prisma = require('./prisma');

async function generateDocNumber(modelName, numberField, prefix) {
  const year = new Date().getFullYear();
  const prefixYear = `${prefix}-${year}-`;

  // Number fields (saleNumber, quotationNumber, etc.) are globally unique,
  // not per-warehouse — but several of these models are warehouse-scoped
  // reads, so this must go through the unscoped client. Otherwise a
  // warehouse with no documents of this type yet sees no existing rows,
  // restarts the count from 0001, and collides with another warehouse's
  // real sequence.
  const last = await prisma.base[modelName].findFirst({
    where: { [numberField]: { startsWith: prefixYear } },
    orderBy: { [numberField]: 'desc' },
  });

  const lastNum = last ? parseInt(last[numberField].split('-').pop(), 10) : 0;
  return `${prefixYear}${String(lastNum + 1).padStart(4, '0')}`;
}

module.exports = { generateDocNumber };
