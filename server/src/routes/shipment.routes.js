const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const ctrl = require('../controllers/shipment.controller');

const router = Router();
router.use(authenticate);

// List & detail
router.get('/', authorize('SHIPMENTS_VIEW'), ctrl.listShipments);
router.get('/:id', authorize('SHIPMENTS_VIEW'), ctrl.getShipment);

// 1) Create + 3) Add shipment details + delete — Inventory Manager
router.post('/', authorize('SHIPMENTS_CREATE'), ctrl.createShipment);
router.post('/:id/details', authorize('SHIPMENTS_CREATE'), ctrl.addShipmentDetails);
router.delete('/:id', authorize('SHIPMENTS_CREATE'), ctrl.deleteShipment);

// 2) Approve / reject — Boss
router.post('/:id/approve', authorize('SHIPMENTS_APPROVE'), ctrl.approveShipment);
router.post('/:id/reject', authorize('SHIPMENTS_APPROVE'), ctrl.rejectShipment);

// 4) Receive / decline — destination warehouse staff
router.post('/:id/receive', authorize('SHIPMENTS_RECEIVE'), ctrl.receiveShipment);
router.post('/:id/decline', authorize('SHIPMENTS_RECEIVE'), ctrl.declineShipment);

module.exports = router;
