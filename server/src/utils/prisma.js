require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { getWarehouseId } = require('./warehouseContext');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const basePrisma = new PrismaClient({ adapter });

// Models that are scoped per warehouse. When an active warehouse is set on the
// request context, reads are filtered by it and creates are tagged with it.
const SCOPED_MODELS = new Set([
  'Client',
  'ClientTransaction',
  'Quotation',
  'PurchaseOrder',
  'Sale',
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

module.exports = prisma;
