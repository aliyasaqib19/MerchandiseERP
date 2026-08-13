require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { getWarehouseId } = require('./warehouseContext');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
// Neon serverless connections can have cold-start/wake latency well past
// Prisma's 5s default interactive-transaction timeout, which was causing
// spurious 500s on otherwise-correct requests (e.g. stock-in). 20s gives
// real headroom without masking genuinely stuck transactions.
const basePrisma = new PrismaClient({
  adapter,
  transactionOptions: { maxWait: 20000, timeout: 20000 },
});

// Models that are scoped per warehouse. When an active warehouse is set on the
// request context, reads are filtered by it and creates are tagged with it.
const SCOPED_MODELS = new Set([
  'Client',
  'ClientTransaction',
  'Quotation',
  'PurchaseOrder',
  'Sale',
  'SalesReturn',
  'DemoItem',
  'Project',
  'Document',
  'ApprovalRequest',
  'Product',
  'InventoryTransaction',
]);

const READ_OPS = new Set(['findMany', 'findFirst', 'count', 'aggregate', 'groupBy']);

function withWarehouseFilter(args, warehouseId) {
  const filter = { warehouseId };
  args = args || {};
  args.where = args.where ? { AND: [args.where, filter] } : filter;
  return args;
}

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const warehouseId = getWarehouseId();

        // No active warehouse, or model is not scoped → run unchanged.
        if (!warehouseId || !SCOPED_MODELS.has(model)) {
          return query(args);
        }

        if (READ_OPS.has(operation)) {
          return query(withWarehouseFilter(args, warehouseId));
        }

        if (operation === 'create') {
          if (args.data && !Array.isArray(args.data) && args.data.warehouseId === undefined) {
            args.data.warehouseId = warehouseId;
          }
          return query(args);
        }

        if (operation === 'createMany') {
          if (Array.isArray(args.data)) {
            args.data = args.data.map((d) =>
              d.warehouseId === undefined ? { ...d, warehouseId } : d
            );
          }
          return query(args);
        }

        if (operation === 'updateMany' || operation === 'deleteMany') {
          return query(withWarehouseFilter(args, warehouseId));
        }

        return query(args);
      },
    },
  },
});

// Expose the raw (unscoped) client for queries that must ignore the active
// warehouse — e.g. the company-wide brand catalog.
prisma.base = basePrisma;

module.exports = prisma;
