const { Router } = require('express');
const { body } = require('express-validator');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const ctrl = require('../controllers/warehouse.controller');

const router = Router();
router.use(authenticate);

router.get('/',           authorize('INVENTORY_VIEW'),   ctrl.getWarehouses);
router.get('/:id',        authorize('INVENTORY_VIEW'),   ctrl.getWarehouse);
router.get('/:id/stats',  authorize('INVENTORY_VIEW'),   ctrl.getWarehouseStats);
router.get('/:id/products',  authorize('INVENTORY_VIEW'), ctrl.getWarehouseProducts);
router.get('/:id/movements', authorize('INVENTORY_VIEW'), ctrl.getWarehouseMovements);

router.post('/',
  authorize('INVENTORY_CREATE'),
  [body('name').notEmpty().trim()],
  validate,
  ctrl.createWarehouse
);

router.put('/:id',    authorize('INVENTORY_UPDATE'), ctrl.updateWarehouse);
router.delete('/:id', authorize('INVENTORY_DELETE'), ctrl.deleteWarehouse);

module.exports = router;
