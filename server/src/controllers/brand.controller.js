const prisma = require('../utils/prisma');
const { logAudit } = require('./audit.controller');

// Brand catalog is company-wide — use the unscoped client so products/distribution
// are not filtered by the active warehouse.
const db = prisma.base;

// ─── List brands (with product count scoped to the active warehouse) ───────────

async function listBrands(req, res) {
  const brands = await prisma.brand.findMany({ orderBy: { name: 'asc' } });

  // Company-wide product counts + total units (across all warehouses)
  const grouped = await db.product.groupBy({
    by: ['brandId'],
    where: { brandId: { not: null }, status: 'ACTIVE' },
    _count: { _all: true },
    _sum: { quantity: true },
  });
  const countMap = {};
  for (const g of grouped) countMap[g.brandId] = { products: g._count._all, units: g._sum.quantity || 0 };

  res.json(
    brands.map((b) => ({
      ...b,
      productCount: countMap[b.id]?.products || 0,
      totalUnits: countMap[b.id]?.units || 0,
    }))
  );
}

async function getBrand(req, res) {
  const id = Number(req.params.id);
  const brand = await prisma.brand.findUnique({ where: { id } });
  if (!brand) return res.status(404).json({ message: 'Brand not found' });
  res.json(brand);
}

// ─── Products of a brand (scoped to active warehouse) ──────────────────────────

async function getBrandProducts(req, res) {
  const id = Number(req.params.id);
  const products = await db.product.findMany({
    where: { brandId: id },
    include: {
      category: { select: { id: true, name: true } },
      warehouse: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  });
  res.json(products);
}

// ─── Product client-distribution ("how many given to which client") ────────────

async function getProductDistribution(req, res) {
  const productId = Number(req.params.productId);

  const product = await db.product.findUnique({
    where: { id: productId },
    include: { category: { select: { name: true } }, brand: { select: { id: true, name: true } } },
  });
  if (!product) return res.status(404).json({ message: 'Product not found' });

  const saleItems = await db.saleItem.findMany({
    where: { productId },
    include: {
      sale: {
        select: {
          id: true, saleNumber: true, saleDate: true, status: true,
          client: { select: { id: true, companyName: true } },
        },
      },
    },
    orderBy: { sale: { saleDate: 'desc' } },
  });

  // Per-client aggregation
  const byClient = {};
  let totalGiven = 0;
  let totalValue = 0;
  for (const it of saleItems) {
    const client = it.sale?.client;
    const key = client?.id || 'unknown';
    if (!byClient[key]) {
      byClient[key] = { clientId: client?.id || null, companyName: client?.companyName || 'Unknown', quantity: 0, value: 0, orders: 0 };
    }
    byClient[key].quantity += it.quantity;
    byClient[key].value += it.total;
    byClient[key].orders += 1;
    totalGiven += it.quantity;
    totalValue += it.total;
  }

  const lines = saleItems.map((it) => ({
    id: it.id,
    saleId: it.sale?.id,
    saleNumber: it.sale?.saleNumber,
    saleDate: it.sale?.saleDate,
    saleStatus: it.sale?.status,
    companyName: it.sale?.client?.companyName || 'Unknown',
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    total: it.total,
  }));

  res.json({
    product: {
      id: product.id, sku: product.sku, name: product.name, unitType: product.unitType,
      quantity: product.quantity, sellingPrice: product.sellingPrice,
      category: product.category?.name, brand: product.brand,
    },
    totals: { totalGiven, totalValue, clients: Object.keys(byClient).length },
    byClient: Object.values(byClient).sort((a, b) => b.quantity - a.quantity),
    lines,
  });
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

async function createBrand(req, res) {
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: 'Brand name is required' });
  const existing = await prisma.brand.findUnique({ where: { name: name.trim() } });
  if (existing) return res.status(409).json({ message: 'A brand with this name already exists' });

  const brand = await prisma.brand.create({ data: { name: name.trim(), description: description || null } });
  logAudit({ userId: req.user.id, action: 'CREATE', module: 'INVENTORY', resourceId: brand.id, resourceType: 'Brand', newValues: { name: brand.name }, req });
  res.status(201).json(brand);
}

async function updateBrand(req, res) {
  const id = Number(req.params.id);
  const { name, description } = req.body;
  const brand = await prisma.brand.update({
    where: { id },
    data: { ...(name !== undefined ? { name: name.trim() } : {}), ...(description !== undefined ? { description } : {}) },
  });
  logAudit({ userId: req.user.id, action: 'UPDATE', module: 'INVENTORY', resourceId: id, resourceType: 'Brand', newValues: { name: brand.name }, req });
  res.json(brand);
}

async function deleteBrand(req, res) {
  const id = Number(req.params.id);
  await prisma.brand.delete({ where: { id } }); // products keep existing, brandId set null via FK
  logAudit({ userId: req.user.id, action: 'DELETE', module: 'INVENTORY', resourceId: id, resourceType: 'Brand', req });
  res.json({ message: 'Brand deleted' });
}

module.exports = {
  listBrands, getBrand, getBrandProducts, getProductDistribution,
  createBrand, updateBrand, deleteBrand,
};
