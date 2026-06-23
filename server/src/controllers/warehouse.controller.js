const prisma = require('../utils/prisma');
const { logAudit } = require('./audit.controller');

// GET /warehouses
async function getWarehouses(req, res) {
  try {
    const allowed = req.user?.warehouseIds || [];
    const where = allowed.length > 0 ? { id: { in: allowed } } : {};
    const warehouses = await prisma.warehouse.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { products: true, transactions: true } },
      },
    });
    res.json(warehouses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch warehouses' });
  }
}

// GET /warehouses/:id
async function getWarehouse(req, res) {
  try {
    const id = parseInt(req.params.id);
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true, transactions: true } },
      },
    });
    if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });
    res.json(warehouse);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch warehouse' });
  }
}

// GET /warehouses/:id/stats
async function getWarehouseStats(req, res) {
  try {
    const id = parseInt(req.params.id);

    const [productCount, totalValue, recentTx] = await Promise.all([
      prisma.product.count({ where: { warehouseId: id, status: 'ACTIVE' } }),
      prisma.product.aggregate({
        where: { warehouseId: id, status: 'ACTIVE' },
        _sum: { quantity: true },
      }),
      prisma.inventoryTransaction.count({
        where: { warehouseId: id },
      }),
    ]);

    // Low stock: products where quantity <= minThreshold
    const lowStockProducts = await prisma.product.findMany({
      where: {
        warehouseId: id,
        status: 'ACTIVE',
      },
      select: { id: true, quantity: true, minThreshold: true },
    });
    const lowStockCount = lowStockProducts.filter((p) => p.quantity <= p.minThreshold).length;

    res.json({
      productCount,
      totalUnits: totalValue._sum.quantity || 0,
      lowStockCount,
      totalTransactions: recentTx,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch warehouse stats' });
  }
}

// GET /warehouses/:id/products
async function getWarehouseProducts(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { search, status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { warehouseId: id };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ products, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch warehouse products' });
  }
}

// GET /warehouses/:id/movements
async function getWarehouseMovements(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { page = 1, limit = 20, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = { warehouseId: id };
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true, unitType: true } },
          user: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);

    res.json({ transactions, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch warehouse movements' });
  }
}

// POST /warehouses
async function createWarehouse(req, res) {
  try {
    const { name, city, address, contactPerson, phone, notes, capacity } = req.body;
    const warehouse = await prisma.warehouse.create({
      data: { name, city, address, contactPerson, phone, notes, capacity: capacity ? parseInt(capacity) : null },
    });
    await logAudit({ userId: req.user?.id, action: 'CREATE', module: 'WAREHOUSES', resourceId: warehouse.id, resourceType: 'Warehouse', newValues: JSON.stringify(warehouse), req });
    res.status(201).json(warehouse);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ message: 'A warehouse with this name already exists' });
    console.error(err);
    res.status(500).json({ message: 'Failed to create warehouse' });
  }
}

// PUT /warehouses/:id
async function updateWarehouse(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { name, city, address, contactPerson, phone, notes, capacity, status } = req.body;
    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: { name, city, address, contactPerson, phone, notes, capacity: capacity ? parseInt(capacity) : null, status },
    });
    await logAudit({ userId: req.user?.id, action: 'UPDATE', module: 'WAREHOUSES', resourceId: id, resourceType: 'Warehouse', newValues: JSON.stringify(req.body), req });
    res.json(warehouse);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Warehouse not found' });
    console.error(err);
    res.status(500).json({ message: 'Failed to update warehouse' });
  }
}

// DELETE /warehouses/:id
async function deleteWarehouse(req, res) {
  try {
    const id = parseInt(req.params.id);
    // Unassign products from warehouse before deleting
    await prisma.product.updateMany({ where: { warehouseId: id }, data: { warehouseId: null } });
    await prisma.inventoryTransaction.updateMany({ where: { warehouseId: id }, data: { warehouseId: null } });
    await prisma.warehouse.delete({ where: { id } });
    await logAudit({ userId: req.user?.id, action: 'DELETE', module: 'WAREHOUSES', resourceId: id, resourceType: 'Warehouse', req });
    res.json({ message: 'Warehouse deleted' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Warehouse not found' });
    console.error(err);
    res.status(500).json({ message: 'Failed to delete warehouse' });
  }
}

module.exports = { getWarehouses, getWarehouse, getWarehouseStats, getWarehouseProducts, getWarehouseMovements, createWarehouse, updateWarehouse, deleteWarehouse };
