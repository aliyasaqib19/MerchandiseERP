const { runWithWarehouse } = require('../utils/warehouseContext');

// Reads the active warehouse from the `x-warehouse-id` header and runs the
// rest of the request inside an AsyncLocalStorage context. The Prisma client
// extension picks this up to auto-filter / auto-assign warehouse-scoped models.
module.exports = function warehouseScope(req, res, next) {
  const raw = req.headers['x-warehouse-id'];
  const warehouseId = raw && !Number.isNaN(parseInt(raw)) ? parseInt(raw) : null;
  req.warehouseId = warehouseId;
  runWithWarehouse(warehouseId, () => next());
};
