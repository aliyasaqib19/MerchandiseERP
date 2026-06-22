const { AsyncLocalStorage } = require('async_hooks');

// Holds per-request state: { warehouseId }
const storage = new AsyncLocalStorage();

function runWithWarehouse(warehouseId, fn) {
  return storage.run({ warehouseId: warehouseId ?? null }, fn);
}

function getWarehouseId() {
  const store = storage.getStore();
  return store ? store.warehouseId : null;
}

module.exports = { storage, runWithWarehouse, getWarehouseId };
