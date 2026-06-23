const prisma = require('../utils/prisma');
const { logAudit } = require('./audit.controller');

// ─── Stats ────────────────────────────────────────────────────────────────────

async function getStats(req, res) {
  const [totalProducts, allProducts, lowStockProducts, monthlyTxCount] = await Promise.all([
    prisma.product.count({ where: { status: 'ACTIVE' } }),

    prisma.product.findMany({
      where: { status: 'ACTIVE' },
      select: { quantity: true, costPrice: true, minThreshold: true },
    }),

    prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        minThreshold: { gt: 0 },
        quantity: { lte: prisma.product.fields?.minThreshold ?? 0 },
      },
      select: { id: true, sku: true, name: true, quantity: true, minThreshold: true, unitType: true },
    }).catch(() => []), // fallback — raw computed below

    prisma.inventoryTransaction.count({
      where: {
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
  ]);

  // Compute inventory value and low-stock in JS (Prisma doesn't aggregate qty*price)
  let totalValue = 0;
  let lowStockCount = 0;
  for (const p of allProducts) {
    if (p.costPrice) totalValue += p.quantity * p.costPrice;
    if (p.minThreshold > 0 && p.quantity <= p.minThreshold) lowStockCount++;
  }

  // Fetch actual low-stock list properly
  const lowStockList = await prisma.product.findMany({
    where: { status: 'ACTIVE', minThreshold: { gt: 0 } },
    select: {
      id: true, sku: true, name: true, quantity: true, minThreshold: true, unitType: true,
      category: { select: { name: true } },
    },
    orderBy: { quantity: 'asc' },
  }).then((products) => products.filter((p) => p.quantity <= p.minThreshold));

  res.json({
    totalProducts,
    totalValue: Math.round(totalValue * 100) / 100,
    lowStockCount: lowStockList.length,
    monthlyTransactions: monthlyTxCount,
    lowStockList,
  });
}

// ─── Categories ───────────────────────────────────────────────────────────────

async function getCategories(req, res) {
  const categories = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
  });
  res.json(categories);
}

async function createCategory(req, res) {
  const { name, description } = req.body;
  const exists = await prisma.category.findUnique({ where: { name } });
  if (exists) return res.status(409).json({ message: 'Category already exists' });
  const category = await prisma.category.create({ data: { name, description } });
  logAudit({ userId: req.user.id, action: 'CREATE', module: 'INVENTORY', resourceId: category.id, resourceType: 'Category', newValues: { name }, req });
  res.status(201).json(category);
}

async function updateCategory(req, res) {
  const { name, description } = req.body;
  const category = await prisma.category.update({
    where: { id: Number(req.params.id) },
    data: { name, description },
  });
  logAudit({ userId: req.user.id, action: 'UPDATE', module: 'INVENTORY', resourceId: category.id, resourceType: 'Category', newValues: { name }, req });
  res.json(category);
}

async function deleteCategory(req, res) {
  const id = Number(req.params.id);
  const productCount = await prisma.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    return res.status(400).json({ message: 'Cannot delete category with products assigned to it' });
  }
  await prisma.category.delete({ where: { id } });
  logAudit({ userId: req.user.id, action: 'DELETE', module: 'INVENTORY', resourceId: id, resourceType: 'Category', req });
  res.json({ message: 'Category deleted' });
}

// ─── Products ─────────────────────────────────────────────────────────────────

async function getProducts(req, res) {
  const { search, categoryId, brandId, status, lowStock } = req.query;

  const where = {};
  if (status) where.status = status;
  if (categoryId) where.categoryId = Number(categoryId);
  if (brandId) where.brandId = Number(brandId);
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const products = await prisma.product.findMany({
    where,
    include: {
      category: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Apply low stock filter after fetch (computed field)
  const result = lowStock === 'true'
    ? products.filter((p) => p.minThreshold > 0 && p.quantity <= p.minThreshold)
    : products;

  res.json(result);
}

async function getProduct(req, res) {
  const product = await prisma.product.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      category: { select: { id: true, name: true } },
      transactions: {
        include: { user: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
}

async function createProduct(req, res) {
  const { sku, name, description, categoryId, brandId, unitType, quantity, minThreshold, costPrice, sellingPrice, status } = req.body;

  const exists = await prisma.product.findUnique({ where: { sku } });
  if (exists) return res.status(409).json({ message: 'SKU already exists' });

  const initialQty = Number(quantity) || 0;

  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        sku: sku.toUpperCase().trim(),
        name,
        description,
        categoryId: Number(categoryId),
        brandId: brandId ? Number(brandId) : null,
        unitType: unitType || 'PIECE',
        quantity: initialQty,
        minThreshold: Number(minThreshold) || 0,
        costPrice: costPrice ? Number(costPrice) : null,
        sellingPrice: sellingPrice ? Number(sellingPrice) : null,
        status: status || 'ACTIVE',
      },
      include: { category: { select: { id: true, name: true } }, brand: { select: { id: true, name: true } } },
    });

    // Record initial stock-in if starting quantity > 0
    if (initialQty > 0) {
      await tx.inventoryTransaction.create({
        data: {
          productId: p.id,
          type: 'STOCK_IN',
          quantity: initialQty,
          balanceAfter: initialQty,
          notes: 'Initial stock on product creation',
          createdBy: req.user.id,
        },
      });
    }

    return p;
  });

  logAudit({ userId: req.user.id, action: 'CREATE', module: 'INVENTORY', resourceId: product.id, resourceType: 'Product', newValues: { sku, name, quantity: initialQty }, req });
  res.status(201).json(product);
}

async function updateProduct(req, res) {
  const { name, description, categoryId, brandId, unitType, minThreshold, costPrice, sellingPrice, status } = req.body;

  const product = await prisma.product.update({
    where: { id: Number(req.params.id) },
    data: {
      name,
      description,
      categoryId: categoryId ? Number(categoryId) : undefined,
      brandId: brandId !== undefined ? (brandId ? Number(brandId) : null) : undefined,
      unitType,
      minThreshold: minThreshold !== undefined ? Number(minThreshold) : undefined,
      costPrice: costPrice !== undefined ? (costPrice ? Number(costPrice) : null) : undefined,
      sellingPrice: sellingPrice !== undefined ? (sellingPrice ? Number(sellingPrice) : null) : undefined,
      status,
    },
    include: { category: { select: { id: true, name: true } }, brand: { select: { id: true, name: true } } },
  });

  logAudit({ userId: req.user.id, action: 'UPDATE', module: 'INVENTORY', resourceId: product.id, resourceType: 'Product', newValues: { name, status }, req });
  res.json(product);
}

async function deleteProduct(req, res) {
  const id = Number(req.params.id);
  const txCount = await prisma.inventoryTransaction.count({ where: { productId: id } });

  if (txCount > 0) {
    await prisma.product.update({ where: { id }, data: { status: 'DISCONTINUED' } });
    logAudit({ userId: req.user.id, action: 'DISCONTINUE', module: 'INVENTORY', resourceId: id, resourceType: 'Product', req });
    return res.json({ message: 'Product discontinued (has transaction history)' });
  }

  await prisma.product.delete({ where: { id } });
  logAudit({ userId: req.user.id, action: 'DELETE', module: 'INVENTORY', resourceId: id, resourceType: 'Product', req });
  res.json({ message: 'Product deleted' });
}

// ─── Stock In / Out ───────────────────────────────────────────────────────────

async function stockIn(req, res) {
  const { productId, quantity, reference, notes } = req.body;
  const qty = Number(quantity);

  if (qty <= 0) return res.status(400).json({ message: 'Quantity must be greater than 0' });

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: Number(productId) } });
    if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });

    const newQty = product.quantity + qty;

    await tx.product.update({
      where: { id: product.id },
      data: { quantity: newQty },
    });

    return tx.inventoryTransaction.create({
      data: {
        productId: product.id,
        type: 'STOCK_IN',
        quantity: qty,
        balanceAfter: newQty,
        reference: reference || null,
        notes: notes || null,
        createdBy: req.user.id,
      },
      include: {
        product: { select: { id: true, sku: true, name: true, quantity: true, unitType: true } },
        user: { select: { id: true, fullName: true } },
      },
    });
  });

  logAudit({ userId: req.user.id, action: 'STOCK_IN', module: 'INVENTORY', resourceId: result.productId, resourceType: 'Product', newValues: { quantity: qty, reference, balanceAfter: result.balanceAfter }, req });
  res.status(201).json(result);
}

async function stockOut(req, res) {
  const { productId, quantity, reference, notes } = req.body;
  const qty = Number(quantity);

  if (qty <= 0) return res.status(400).json({ message: 'Quantity must be greater than 0' });

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: Number(productId) } });
    if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });
    if (product.quantity < qty) {
      throw Object.assign(
        new Error(`Insufficient stock. Available: ${product.quantity} ${product.unitType}`),
        { status: 400 }
      );
    }

    const newQty = product.quantity - qty;

    await tx.product.update({
      where: { id: product.id },
      data: { quantity: newQty },
    });

    return tx.inventoryTransaction.create({
      data: {
        productId: product.id,
        type: 'STOCK_OUT',
        quantity: qty,
        balanceAfter: newQty,
        reference: reference || null,
        notes: notes || null,
        createdBy: req.user.id,
      },
      include: {
        product: { select: { id: true, sku: true, name: true, quantity: true, unitType: true } },
        user: { select: { id: true, fullName: true } },
      },
    });
  });

  logAudit({ userId: req.user.id, action: 'STOCK_OUT', module: 'INVENTORY', resourceId: result.productId, resourceType: 'Product', newValues: { quantity: qty, reference, balanceAfter: result.balanceAfter }, req });
  res.status(201).json(result);
}

async function adjustStock(req, res) {
  const { productId, newQuantity, notes } = req.body;
  const targetQty = Number(newQuantity);

  if (targetQty < 0) return res.status(400).json({ message: 'Quantity cannot be negative' });

  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: Number(productId) } });
    if (!product) throw Object.assign(new Error('Product not found'), { status: 404 });

    const diff = targetQty - product.quantity;

    await tx.product.update({ where: { id: product.id }, data: { quantity: targetQty } });

    return tx.inventoryTransaction.create({
      data: {
        productId: product.id,
        type: 'ADJUSTMENT',
        quantity: Math.abs(diff),
        balanceAfter: targetQty,
        notes: notes || `Manual adjustment: ${product.quantity} → ${targetQty}`,
        createdBy: req.user.id,
      },
      include: {
        product: { select: { id: true, sku: true, name: true, quantity: true, unitType: true } },
        user: { select: { id: true, fullName: true } },
      },
    });
  });

  logAudit({ userId: req.user.id, action: 'STOCK_ADJUST', module: 'INVENTORY', resourceId: result.productId, resourceType: 'Product', newValues: { newQuantity: targetQty, balanceAfter: result.balanceAfter }, req });
  res.status(201).json(result);
}

// ─── Transaction History ──────────────────────────────────────────────────────

async function getTransactions(req, res) {
  const { productId, type, dateFrom, dateTo, page = 1, limit = 20 } = req.query;

  const where = {};
  if (productId) where.productId = Number(productId);
  if (type) where.type = type;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [transactions, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where,
      include: {
        product: {
          select: {
            id: true, sku: true, name: true, unitType: true,
            brand: { select: { id: true, name: true } },
          },
        },
        user: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.inventoryTransaction.count({ where }),
  ]);

  res.json({
    transactions,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
  });
}

// ─── Bulk import from Excel (rows parsed on the client) ────────────────────────

async function bulkImportProducts(req, res) {
  const warehouseId = req.warehouseId;
  if (!warehouseId) return res.status(400).json({ message: 'Select a warehouse first.' });

  const { products } = req.body || {};
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ message: 'No rows found in the uploaded sheet.' });
  }

  const db = prisma.base; // unscoped — we handle warehouseId explicitly
  const defaultCat = await db.category.upsert({
    where: { name: 'Imported' }, update: {}, create: { name: 'Imported' },
  });

  // Cache brand lookups within this import
  const brandCache = {};
  async function resolveBrandId(name) {
    const key = name.trim().toLowerCase();
    if (!key) return null;
    if (brandCache[key] !== undefined) return brandCache[key];
    const brand = await db.brand.upsert({ where: { name: name.trim() }, update: {}, create: { name: name.trim() } });
    brandCache[key] = brand.id;
    return brand.id;
  }

  let created = 0, updated = 0, skipped = 0;
  const errors = [];

  for (let i = 0; i < products.length; i++) {
    const row = products[i] || {};
    try {
      const sku = String(row.sku ?? '').trim();
      const name = String(row.name ?? '').trim();
      if (!sku || !name) { skipped++; errors.push(`Row ${i + 1}: missing manufacture no. or product name`); continue; }

      const qty = Number(row.quantity) || 0;
      const cost = row.costPrice === '' || row.costPrice == null ? null : Number(row.costPrice);
      const price = row.sellingPrice === '' || row.sellingPrice == null ? null : Number(row.sellingPrice);
      const brandId = row.brand ? await resolveBrandId(String(row.brand)) : null;

      const existing = await db.product.findUnique({ where: { sku: sku.toUpperCase() } });

      if (existing) {
        await db.product.update({
          where: { id: existing.id },
          data: {
            name,
            brandId: brandId ?? existing.brandId,
            costPrice: cost ?? existing.costPrice,
            sellingPrice: price ?? existing.sellingPrice,
            quantity: qty,
          },
        });
        if (qty !== existing.quantity) {
          await db.inventoryTransaction.create({
            data: {
              productId: existing.id, type: 'ADJUSTMENT', quantity: Math.abs(qty - existing.quantity),
              balanceAfter: qty, reference: 'Excel import', notes: 'Quantity set via Excel import',
              warehouseId: existing.warehouseId || warehouseId, createdBy: req.user.id,
            },
          });
        }
        updated++;
      } else {
        const p = await db.product.create({
          data: {
            sku: sku.toUpperCase(), name, categoryId: defaultCat.id, brandId,
            unitType: 'PIECE', quantity: qty, minThreshold: 0,
            costPrice: cost, sellingPrice: price, status: 'ACTIVE', warehouseId,
          },
        });
        if (qty > 0) {
          await db.inventoryTransaction.create({
            data: {
              productId: p.id, type: 'STOCK_IN', quantity: qty, balanceAfter: qty,
              reference: 'Excel import', notes: 'Initial stock via Excel import',
              warehouseId, createdBy: req.user.id,
            },
          });
        }
        created++;
      }
    } catch (e) {
      skipped++;
      errors.push(`Row ${i + 1}: ${e.message}`);
    }
  }

  logAudit({ userId: req.user.id, action: 'IMPORT', module: 'INVENTORY', resourceType: 'Product', newValues: { created, updated, skipped }, req });
  res.json({ created, updated, skipped, errors: errors.slice(0, 25) });
}

module.exports = {
  getStats,
  getCategories, createCategory, updateCategory, deleteCategory,
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  stockIn, stockOut, adjustStock,
  getTransactions,
  bulkImportProducts,
};
