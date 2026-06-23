const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const ctrl = require('../controllers/brand.controller');

const router = Router();
router.use(authenticate);

router.get('/', authorize('INVENTORY_VIEW'), ctrl.listBrands);
router.get('/:id', authorize('INVENTORY_VIEW'), ctrl.getBrand);
router.get('/:id/products', authorize('INVENTORY_VIEW'), ctrl.getBrandProducts);
router.get('/products/:productId/distribution', authorize('INVENTORY_VIEW'), ctrl.getProductDistribution);

router.post('/', authorize('INVENTORY_CREATE'), ctrl.createBrand);
router.put('/:id', authorize('INVENTORY_UPDATE'), ctrl.updateBrand);
router.delete('/:id', authorize('INVENTORY_DELETE'), ctrl.deleteBrand);

module.exports = router;
