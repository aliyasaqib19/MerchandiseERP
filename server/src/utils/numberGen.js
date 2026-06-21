const prisma = require('./prisma');

async function generateDocNumber(modelName, numberField, prefix) {
  const year = new Date().getFullYear();
  const prefixYear = `${prefix}-${year}-`;

  const last = await prisma[modelName].findFirst({
    where: { [numberField]: { startsWith: prefixYear } },
    orderBy: { [numberField]: 'desc' },
  });

  const lastNum = last ? parseInt(last[numberField].split('-').pop(), 10) : 0;
  return `${prefixYear}${String(lastNum + 1).padStart(4, '0')}`;
}

module.exports = { generateDocNumber };
