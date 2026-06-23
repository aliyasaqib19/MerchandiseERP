const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const ctrl = require('../controllers/shipment.controller');

const router = Router();
router.use(authenticate);

// List & detail
router.get('/', authorize('INVENTORY_VIEW'), ctrl.listShipments);
router.get('/:id', authorize('INVENTORY_VIEW'), ctrl.getShipment);

// Create / submit (source warehouse)
router.post('/', authorize('INVENTORY_CREATE'), ctrl.createShipment);
router.post('/:id/submit', authorize('INVENTORY_CREATE'), ctrl.submitShipment);
router.delete('/:id', authorize('INVENTORY_CREATE'), ctrl.deleteShipment);

// Approve / reject (boss)
router.post('/:id/approve', authorize('INVENTORY_UPDATE'), ctrl.approveShipment);
router.post('/:id/reject', authorize('INVENTORY_UPDATE'), ctrl.rejectShipment);

// Receive / decline (destination warehouse)
router.post('/:id/receive', authorize('INVENTORY_UPDATE'), ctrl.receiveShipment);
router.post('/:id/decline', authorize('INVENTORY_UPDATE'), ctrl.declineShipment);

module.exports = router;
