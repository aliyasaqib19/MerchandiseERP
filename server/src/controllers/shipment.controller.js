const prisma = require('../utils/prisma');
const { logAudit } = require('./audit.controller');

// ─── Helpers ────────────────────────────────────────────────────────────────

// Active users whose role grants a given permission (for targeted notifications)
async function getUsersWithPermission(permName) {
  const rows = await prisma.base.user.findMany({
    where: { status: 'ACTIVE', role: { rolePermissions: { some: { permission: { name: permName } } } } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function notify(userIds, { type, title, message, link }) {
  const unique = [...new Set((userIds || []).filter(Boolean))];
  if (!unique.length) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({ userId, type, title, message, link })),
  });
}

async function nextShipmentNumber() {
  const year = new Date().getFullYear();
  const count = await prisma.shipment.count();
  return `SHP-${year}-${String(count + 1).padStart(4, '0')}`;
}

const LINK = '/inventory/shipments';

// Keep the linked Approval Workflow request in sync with the shipment decision
async function syncApprovalDecision(shipmentId, decision, userId, note) {
  await prisma.base.approvalRequest.updateMany({
    where: { referenceType: 'Shipment', referenceId: shipmentId, status: 'PENDING' },
    data: { status: decision, decidedBy: userId, decidedAt: new Date(), decisionNote: note || null },
  });
}

// ─── List (incoming + outgoing for the active warehouse) ───────────────────────

async function listShipments(req, res) {
  const whId = req.warehouseId;
  if (!whId) return res.status(400).json({ message: 'Select a warehouse first.' });

  const shipments = await prisma.shipment.findMany({
    where: { OR: [{ sourceWarehouseId: whId }, { destWarehouseId: whId }] },
    include: {
      sourceWarehouse: { select: { id: true, name: true } },
      destWarehouse: { select: { id: true, name: true } },
      createdByUser: { select: { id: true, fullName: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json(
    shipments.map((s) => ({
      ...s,
      direction: s.sourceWarehouseId === whId ? 'OUTGOING' : 'INCOMING',
    }))
  );
}

async function getShipment(req, res) {
  const id = Number(req.params.id);
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      sourceWarehouse: { select: { id: true, name: true } },
      destWarehouse: { select: { id: true, name: true } },
      createdByUser: { select: { id: true, fullName: true } },
      items: { include: { product: { select: { id: true, sku: true, name: true, unitType: true, quantity: true, brand: { select: { name: true } } } } } },
    },
  });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
  res.json(shipment);
}

// ─── 1) Create → status WAITING FOR APPROVAL (Inventory Manager) ──────────────

async function createShipment(req, res) {
  const sourceWarehouseId = req.warehouseId;
  if (!sourceWarehouseId) return res.status(400).json({ message: 'Select a warehouse first.' });

  const { destWarehouseId, items, notes } = req.body || {};
  const destId = Number(destWarehouseId);

  if (!destId) return res.status(400).json({ message: 'Destination warehouse is required.' });
  if (destId === sourceWarehouseId) return res.status(400).json({ message: 'Source and destination must differ.' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'Add at least one item.' });

  const dest = await prisma.warehouse.findUnique({ where: { id: destId } });
  if (!dest) return res.status(404).json({ message: 'Destination warehouse not found.' });

  // Load products — scoped to the active (source) warehouse, so only its products qualify
  const productIds = items.map((i) => Number(i.productId));
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const itemData = [];
  for (const i of items) {
    const product = productMap[Number(i.productId)];
    const qty = Number(i.quantity);
    if (!product) return res.status(400).json({ message: `Product ${i.productId} is not in this warehouse.` });
    if (!(qty > 0)) return res.status(400).json({ message: `Invalid quantity for ${product.name}.` });
    itemData.push({ productId: product.id, sku: product.sku, description: product.name, quantity: qty });
  }

  const shipmentNumber = await nextShipmentNumber();
  const shipment = await prisma.shipment.create({
    data: {
      shipmentNumber,
      sourceWarehouseId,
      destWarehouseId: destId,
      status: 'PENDING_APPROVAL',
      notes: notes || null,
      createdBy: req.user.id,
      items: { create: itemData },
    },
    include: { items: true, sourceWarehouse: true, destWarehouse: true },
  });

  // Matching Approval Workflow request so the Boss can act in the Approvals tab
  await prisma.approvalRequest.create({
    data: {
      type: 'SHIPMENT', status: 'PENDING', priority: 'HIGH',
      title: `Shipment ${shipment.shipmentNumber}`,
      description: `${shipment.sourceWarehouse.name} → ${shipment.destWarehouse.name} · ${itemData.length} item(s)`,
      referenceType: 'Shipment', referenceId: shipment.id, requestedBy: req.user.id,
    },
  });

  await notify(await getUsersWithPermission('SHIPMENTS_APPROVE'), {
    type: 'APPROVAL_REQUIRED',
    title: `Shipment ${shipment.shipmentNumber} needs approval`,
    message: `${shipment.sourceWarehouse.name} → ${shipment.destWarehouse.name}. Review the items and approve or decline.`,
    link: LINK,
  });

  logAudit({ userId: req.user.id, action: 'CREATE', module: 'INVENTORY', resourceId: shipment.id, resourceType: 'Shipment', newValues: { shipmentNumber, destWarehouseId: destId, items: itemData.length }, req });
  res.status(201).json(shipment);
}

// ─── 2) Approve / Reject (Boss) ───────────────────────────────────────────────

async function approveShipment(req, res) {
  const id = Number(req.params.id);
  const { note } = req.body || {};
  const shipment = await prisma.shipment.findUnique({ where: { id }, include: { sourceWarehouse: true, destWarehouse: true } });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
  if (shipment.status !== 'PENDING_APPROVAL') return res.status(400).json({ message: 'Shipment is not pending approval.' });

  const updated = await prisma.shipment.update({
    where: { id },
    data: { status: 'APPROVED', approvedBy: req.user.id, approvedAt: new Date(), decisionNote: note || null },
  });
  await syncApprovalDecision(id, 'APPROVED', req.user.id, note);

  // Hand the task back to the creator (Inventory Manager) to add shipment details
  await notify([shipment.createdBy], {
    type: 'APPROVAL_DECIDED',
    title: `Shipment ${shipment.shipmentNumber} approved`,
    message: `Approved by the Boss. Add the Consignment Number & DC to dispatch it to ${shipment.destWarehouse.name}.`,
    link: LINK,
  });

  logAudit({ userId: req.user.id, action: 'APPROVE', module: 'INVENTORY', resourceId: id, resourceType: 'Shipment', newValues: { status: 'APPROVED' }, req });
  res.json(updated);
}

async function rejectShipment(req, res) {
  const id = Number(req.params.id);
  const { note } = req.body || {};
  const shipment = await prisma.shipment.findUnique({ where: { id }, include: { sourceWarehouse: true, destWarehouse: true } });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
  if (shipment.status !== 'PENDING_APPROVAL') return res.status(400).json({ message: 'Shipment is not pending approval.' });

  const updated = await prisma.shipment.update({
    where: { id },
    data: { status: 'REJECTED', approvedBy: req.user.id, approvedAt: new Date(), decisionNote: note || null },
  });
  await syncApprovalDecision(id, 'REJECTED', req.user.id, note);

  await notify([shipment.createdBy], {
    type: 'APPROVAL_DECIDED',
    title: `Shipment ${shipment.shipmentNumber} rejected`,
    message: `The transfer to ${shipment.destWarehouse.name} was rejected by the Boss.${note ? ` Reason: ${note}` : ''}`,
    link: LINK,
  });

  logAudit({ userId: req.user.id, action: 'REJECT', module: 'INVENTORY', resourceId: id, resourceType: 'Shipment', newValues: { status: 'REJECTED' }, req });
  res.json(updated);
}

// ─── 3) Add shipment details: Consignment + DC (Inventory Manager) → DELIVERY ──

async function addShipmentDetails(req, res) {
  const id = Number(req.params.id);
  const { consignmentNumber, challanUrl, challanName } = req.body || {};
  const shipment = await prisma.shipment.findUnique({ where: { id }, include: { sourceWarehouse: true, destWarehouse: true } });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
  if (shipment.status !== 'APPROVED') return res.status(400).json({ message: 'Shipment details can only be added after approval.' });
  if (!consignmentNumber || !consignmentNumber.trim()) return res.status(400).json({ message: 'Consignment number is required.' });
  if (!challanUrl) return res.status(400).json({ message: 'Delivery challan (DC) is required to dispatch.' });

  const updated = await prisma.shipment.update({
    where: { id },
    data: {
      consignmentNumber: consignmentNumber.trim(),
      challanUrl,
      challanName: challanName || 'delivery-challan',
      status: 'DELIVERY',
    },
  });

  // Notify destination warehouse staff to receive
  await notify(await getUsersWithPermission('SHIPMENTS_RECEIVE'), {
    type: 'INFO',
    title: `Incoming shipment ${shipment.shipmentNumber}`,
    message: `Goods are on the way to ${shipment.destWarehouse.name} from ${shipment.sourceWarehouse.name}. Consignment ${consignmentNumber.trim()}. Match it with the DC and confirm receipt.`,
    link: LINK,
  });

  logAudit({ userId: req.user.id, action: 'STATUS_CHANGE', module: 'INVENTORY', resourceId: id, resourceType: 'Shipment', newValues: { status: 'DELIVERY', consignmentNumber: consignmentNumber.trim() }, req });
  res.json(updated);
}

// ─── 4) Receive (destination staff) → moves stock ────────────────────────────

async function receiveShipment(req, res) {
  const id = Number(req.params.id);
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: { items: true, sourceWarehouse: true, destWarehouse: true },
  });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
  if (shipment.status !== 'DELIVERY') return res.status(400).json({ message: 'Only shipments in delivery can be received.' });

  // Must be acting within the destination warehouse so stock lands in the right place
  if (req.warehouseId !== shipment.destWarehouseId) {
    return res.status(400).json({ message: `Switch to "${shipment.destWarehouse.name}" to receive this delivery.` });
  }

  const destId = shipment.destWarehouseId;

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of shipment.items) {
        // Deduct from source
        const srcProduct = await tx.product.findUnique({ where: { id: item.productId } });
        if (!srcProduct) throw Object.assign(new Error(`Source product missing for ${item.description}`), { status: 400 });
        if (srcProduct.quantity < item.quantity) {
          throw Object.assign(new Error(`Insufficient stock at source for ${srcProduct.name} (have ${srcProduct.quantity}, need ${item.quantity}).`), { status: 400 });
        }
        const srcNewQty = srcProduct.quantity - item.quantity;
        await tx.product.update({ where: { id: srcProduct.id }, data: { quantity: srcNewQty } });
        await tx.inventoryTransaction.create({
          data: {
            productId: srcProduct.id, type: 'STOCK_OUT', quantity: item.quantity, balanceAfter: srcNewQty,
            reference: shipment.shipmentNumber, notes: `Transfer to ${shipment.destWarehouse.name}`,
            warehouseId: shipment.sourceWarehouseId, createdBy: req.user.id,
          },
        });

        // Add to destination (match by name, else clone the product into dest)
        let destProduct = await tx.product.findFirst({ where: { name: srcProduct.name, warehouseId: destId } });
        if (!destProduct) {
          let sku = `${srcProduct.sku}-${destId}`;
          const clash = await tx.product.findUnique({ where: { sku } });
          if (clash) sku = `${srcProduct.sku}-${destId}-${Date.now()}`;
          destProduct = await tx.product.create({
            data: {
              sku, name: srcProduct.name, description: srcProduct.description,
              categoryId: srcProduct.categoryId, brandId: srcProduct.brandId, unitType: srcProduct.unitType,
              quantity: 0, minThreshold: srcProduct.minThreshold,
              costPrice: srcProduct.costPrice, sellingPrice: srcProduct.sellingPrice,
              imageUrl: srcProduct.imageUrl, status: 'ACTIVE', warehouseId: destId,
            },
          });
        }
        const destNewQty = destProduct.quantity + item.quantity;
        await tx.product.update({ where: { id: destProduct.id }, data: { quantity: destNewQty } });
        await tx.inventoryTransaction.create({
          data: {
            productId: destProduct.id, type: 'STOCK_IN', quantity: item.quantity, balanceAfter: destNewQty,
            reference: shipment.shipmentNumber, notes: `Transfer from ${shipment.sourceWarehouse.name}`,
            warehouseId: destId, createdBy: req.user.id,
          },
        });
      }

      await tx.shipment.update({ where: { id }, data: { status: 'RECEIVED', receivedBy: req.user.id, receivedAt: new Date() } });
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Failed to receive shipment' });
  }

  await notify([shipment.createdBy, ...(await getUsersWithPermission('SHIPMENTS_APPROVE'))], {
    type: 'SUCCESS',
    title: `Shipment ${shipment.shipmentNumber} received`,
    message: `${shipment.destWarehouse.name} confirmed receipt from ${shipment.sourceWarehouse.name}. Stock has been moved between warehouses.`,
    link: LINK,
  });

  logAudit({ userId: req.user.id, action: 'STATUS_CHANGE', module: 'INVENTORY', resourceId: id, resourceType: 'Shipment', newValues: { status: 'RECEIVED' }, req });
  res.json({ message: 'Delivery received and stock updated.' });
}

// ─── Decline delivery (DELIVERY → DECLINED, no stock change) ────────────────────

async function declineShipment(req, res) {
  const id = Number(req.params.id);
  const { note } = req.body || {};
  const shipment = await prisma.shipment.findUnique({ where: { id }, include: { sourceWarehouse: true, destWarehouse: true } });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
  if (shipment.status !== 'DELIVERY') return res.status(400).json({ message: 'Only shipments in delivery can be declined.' });
  if (req.warehouseId !== shipment.destWarehouseId) {
    return res.status(400).json({ message: `Switch to "${shipment.destWarehouse.name}" to act on this delivery.` });
  }

  const updated = await prisma.shipment.update({
    where: { id },
    data: { status: 'DECLINED', receivedBy: req.user.id, receivedAt: new Date(), decisionNote: note || null },
  });

  await notify([shipment.createdBy, ...(await getUsersWithPermission('SHIPMENTS_APPROVE'))], {
    type: 'WARNING',
    title: `Shipment ${shipment.shipmentNumber} declined`,
    message: `${shipment.destWarehouse.name} declined the delivery. No stock was moved.${note ? ` Reason: ${note}` : ''}`,
    link: LINK,
  });

  logAudit({ userId: req.user.id, action: 'STATUS_CHANGE', module: 'INVENTORY', resourceId: id, resourceType: 'Shipment', newValues: { status: 'DECLINED' }, req });
  res.json(updated);
}

// ─── Delete (only before approval) ─────────────────────────────────────────────

async function deleteShipment(req, res) {
  const id = Number(req.params.id);
  const shipment = await prisma.shipment.findUnique({ where: { id } });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
  if (!['PENDING_APPROVAL', 'IN_PROCESS'].includes(shipment.status)) {
    return res.status(400).json({ message: 'Only shipments awaiting approval can be deleted.' });
  }

  await prisma.base.approvalRequest.deleteMany({ where: { referenceType: 'Shipment', referenceId: id } });
  await prisma.shipment.delete({ where: { id } });
  logAudit({ userId: req.user.id, action: 'DELETE', module: 'INVENTORY', resourceId: id, resourceType: 'Shipment', req });
  res.json({ message: 'Shipment deleted.' });
}

module.exports = {
  listShipments, getShipment, createShipment,
  approveShipment, rejectShipment, addShipmentDetails,
  receiveShipment, declineShipment, deleteShipment,
};
