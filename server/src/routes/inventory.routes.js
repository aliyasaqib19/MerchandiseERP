const { Router } = require('express');
const { body, query } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/inventory.controller');

const router = Router();
router.use(authenticate);

// ─── Stats ────────────────────────────────────────────────────────────────────
router.get('/stats', authorize('INVENTORY_VIEW'), ctrl.getStats);

// ─── Categories ───────────────────────────────────────────────────────────────
router.get('/categories', authorize('INVENTORY_VIEW'), ctrl.getCategories);
router.post('/categories',
  authorize('INVENTORY_CREATE'),
  [body('name').notEmpty().trim()],
  validate,
  ctrl.createCategory
);
router.put('/categories/:id', authorize('INVENTORY_UPDATE'), ctrl.updateCategory);
router.delete('/categories/:id', authorize('INVENTORY_DELETE'), ctrl.deleteCategory);

// ─── Products ─────────────────────────────────────────────────────────────────
router.get('/products', authorize('INVENTORY_VIEW'), ctrl.getProducts);
router.post('/products/bulk', authorize('INVENTORY_CREATE'), ctrl.bulkImportProducts);
router.get('/products/:id', authorize('INVENTORY_VIEW'), ctrl.getProduct);

router.post('/products',
  authorize('INVENTORY_CREATE'),
  [
    body('sku').notEmpty().trim(),
    body('name').notEmpty().trim(),
    body('categoryId').isInt({ min: 1 }),
  ],
  validate,
  ctrl.createProduct
);

router.put('/products/:id', authorize('INVENTORY_UPDATE'), ctrl.updateProduct);
router.delete('/products/:id', authorize('INVENTORY_DELETE'), ctrl.deleteProduct);

// ─── Stock Operations ─────────────────────────────────────────────────────────
router.post('/stock-in',
  authorize('INVENTORY_CREATE'),
  [
    body('productId').isInt({ min: 1 }),
    body('quantity').isFloat({ min: 0.01 }),
  ],
  validate,
  ctrl.stockIn
);

router.post('/stock-out',
  authorize('INVENTORY_UPDATE'),
  [
    body('productId').isInt({ min: 1 }),
    body('quantity').isFloat({ min: 0.01 }),
  ],
  validate,
  ctrl.stockOut
);

router.post('/adjust',
  authorize('INVENTORY_UPDATE'),
  [
    body('productId').isInt({ min: 1 }),
    body('newQuantity').isFloat({ min: 0 }),
  ],
  validate,
  ctrl.adjustStock
);

// ─── Transaction History ──────────────────────────────────────────────────────
router.get('/transactions', authorize('INVENTORY_VIEW'), ctrl.getTransactions);

module.exports = router;
