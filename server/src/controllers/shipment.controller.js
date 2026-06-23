const prisma = require('../utils/prisma');
const { logAudit } = require('./audit.controller');

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getBossUserIds() {
  const bosses = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { role: { name: { contains: 'Admin', mode: 'insensitive' } } },
        { role: { name: { contains: 'Manager', mode: 'insensitive' } } },
        { role: { name: { contains: 'Regional', mode: 'insensitive' } } },
      ],
    },
    select: { id: true },
  });
  return bosses.map((b) => b.id);
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

// Return previously-deducted source stock (used on reject / decline)
async function restoreSourceStock(tx, shipment, userId) {
  for (const item of shipment.items) {
    const p = await tx.product.findUnique({ where: { id: item.productId } });
    if (!p) continue;
    const newQty = p.quantity + item.quantity;
    await tx.product.update({ where: { id: p.id }, data: { quantity: newQty } });
    await tx.inventoryTransaction.create({
      data: {
        productId: p.id, type: 'STOCK_IN', quantity: item.quantity, balanceAfter: newQty,
        reference: shipment.shipmentNumber, notes: `Shipment ${shipment.shipmentNumber} cancelled — stock returned`,
        warehouseId: shipment.sourceWarehouseId, createdBy: userId,
      },
    });
  }
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
      items: { include: { product: { select: { id: true, sku: true, name: true, unitType: true, quantity: true } } } },
    },
  });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
  res.json(shipment);
}

// ─── Create (status IN_PROCESS) ────────────────────────────────────────────────

async function createShipment(req, res) {
  const sourceWarehouseId = req.warehouseId;
  if (!sourceWarehouseId) return res.status(400).json({ message: 'Select a warehouse first.' });

  const { destWarehouseId, items, notes, consignmentNumber, challanUrl, challanName } = req.body || {};
  const destId = Number(destWarehouseId);

  if (!destId) return res.status(400).json({ message: 'Destination warehouse is required.' });
  if (destId === sourceWarehouseId) return res.status(400).json({ message: 'Source and destination must differ.' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'Add at least one item.' });
  if (!consignmentNumber || !consignmentNumber.trim()) return res.status(400).json({ message: 'Consignment number is required.' });
  if (!challanUrl) return res.status(400).json({ message: 'Delivery challan is required. Please upload the challan to create the shipment.' });

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
      consignmentNumber: consignmentNumber.trim(),
      challanUrl,
      challanName: challanName || 'delivery-challan',
      sourceWarehouseId,
      destWarehouseId: destId,
      status: 'IN_PROCESS',
      notes: notes || null,
      createdBy: req.user.id,
      items: { create: itemData },
    },
    include: { items: true },
  });

  logAudit({ userId: req.user.id, action: 'CREATE', module: 'INVENTORY', resourceId: shipment.id, resourceType: 'Shipment', newValues: { shipmentNumber, destWarehouseId: destId, items: itemData.length }, req });
  res.status(201).json(shipment);
}

// ─── Submit for approval (IN_PROCESS → PENDING_APPROVAL) ───────────────────────

async function submitShipment(req, res) {
  const id = Number(req.params.id);
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: { items: true, sourceWarehouse: true, destWarehouse: true },
  });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
  if (shipment.status !== 'IN_PROCESS') return res.status(400).json({ message: 'Only in-process shipments can be submitted.' });

  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      // Deduct stock from the source warehouse now (on submit)
      for (const item of shipment.items) {
        const p = await tx.product.findUnique({ where: { id: item.productId } });
        if (!p) throw Object.assign(new Error(`Product missing for ${item.description}.`), { status: 400 });
        if (p.quantity < item.quantity) {
          throw Object.assign(new Error(`Insufficient stock for ${p.name} (have ${p.quantity}, need ${item.quantity}).`), { status: 400 });
        }
        const newQty = p.quantity - item.quantity;
        await tx.product.update({ where: { id: p.id }, data: { quantity: newQty } });
        await tx.inventoryTransaction.create({
          data: {
            productId: p.id, type: 'STOCK_OUT', quantity: item.quantity, balanceAfter: newQty,
            reference: shipment.shipmentNumber, notes: `Shipment to ${shipment.destWarehouse.name} (submitted)`,
            warehouseId: shipment.sourceWarehouseId, createdBy: req.user.id,
          },
        });
      }
      return tx.shipment.update({ where: { id }, data: { status: 'PENDING_APPROVAL', stockDeducted: true } });
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Failed to submit shipment' });
  }

  const bosses = await getBossUserIds();
  await notify(bosses, {
    type: 'APPROVAL_REQUIRED',
    title: `Shipment ${shipment.shipmentNumber} needs approval`,
    message: `${shipment.sourceWarehouse.name} → ${shipment.destWarehouse.name}. Stock has been deducted from ${shipment.sourceWarehouse.name}; review and approve.`,
    link: LINK,
  });

  logAudit({ userId: req.user.id, action: 'STATUS_CHANGE', module: 'INVENTORY', resourceId: id, resourceType: 'Shipment', newValues: { status: 'PENDING_APPROVAL', stockDeducted: true }, req });
  res.json(updated);
}

// ─── Approve (PENDING_APPROVAL → APPROVED) ─────────────────────────────────────

async function approveShipment(req, res) {
  const id = Number(req.params.id);
  const { note } = req.body || {};
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: { sourceWarehouse: true, destWarehouse: true },
  });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
  if (shipment.status !== 'PENDING_APPROVAL') return res.status(400).json({ message: 'Shipment is not pending approval.' });

  const updated = await prisma.shipment.update({
    where: { id },
    data: { status: 'APPROVED', approvedBy: req.user.id, approvedAt: new Date(), decisionNote: note || null },
  });

  const recipients = [...(await getBossUserIds()), shipment.createdBy];
  await notify(recipients, {
    type: 'APPROVAL_DECIDED',
    title: `Shipment ${shipment.shipmentNumber} approved`,
    message: `Approved for ${shipment.destWarehouse.name}. Switch to ${shipment.destWarehouse.name} to accept the delivery.`,
    link: LINK,
  });

  logAudit({ userId: req.user.id, action: 'APPROVE', module: 'INVENTORY', resourceId: id, resourceType: 'Shipment', newValues: { status: 'APPROVED' }, req });
  res.json(updated);
}

// ─── Reject (PENDING_APPROVAL → REJECTED) ──────────────────────────────────────

async function rejectShipment(req, res) {
  const id = Number(req.params.id);
  const { note } = req.body || {};
  const shipment = await prisma.shipment.findUnique({ where: { id }, include: { items: true, sourceWarehouse: true, destWarehouse: true } });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
  if (shipment.status !== 'PENDING_APPROVAL') return res.status(400).json({ message: 'Shipment is not pending approval.' });

  const updated = await prisma.$transaction(async (tx) => {
    if (shipment.stockDeducted) await restoreSourceStock(tx, shipment, req.user.id);
    return tx.shipment.update({
      where: { id },
      data: { status: 'REJECTED', approvedBy: req.user.id, approvedAt: new Date(), decisionNote: note || null, stockDeducted: false },
    });
  });

  await notify([shipment.createdBy], {
    type: 'APPROVAL_DECIDED',
    title: `Shipment ${shipment.shipmentNumber} rejected`,
    message: `The transfer to ${shipment.destWarehouse.name} was rejected. Stock has been returned to ${shipment.sourceWarehouse.name}.${note ? ` Reason: ${note}` : ''}`,
    link: LINK,
  });

  logAudit({ userId: req.user.id, action: 'REJECT', module: 'INVENTORY', resourceId: id, resourceType: 'Shipment', newValues: { status: 'REJECTED' }, req });
  res.json(updated);
}

// ─── Receive / accept delivery (APPROVED → RECEIVED, moves stock) ──────────────

async function receiveShipment(req, res) {
  const id = Number(req.params.id);
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: { items: true, sourceWarehouse: true, destWarehouse: true },
  });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
  if (shipment.status !== 'APPROVED') return res.status(400).json({ message: 'Only approved shipments can be received.' });

  // Must be acting within the destination warehouse so stock lands in the right place
  if (req.warehouseId !== shipment.destWarehouseId) {
    return res.status(400).json({ message: `Switch to "${shipment.destWarehouse.name}" to accept this delivery.` });
  }

  const destId = shipment.destWarehouseId;
  const sourceId = shipment.sourceWarehouseId;

  await prisma.$transaction(async (tx) => {
    for (const item of shipment.items) {
      // Source stock was already deducted at submit time. We only need the source
      // product's details to match/clone the destination product.
      const srcProduct = await tx.product.findUnique({ where: { id: item.productId } });
      if (!srcProduct) throw Object.assign(new Error(`Source product missing for ${item.description}`), { status: 400 });

      // Destination: find matching product by name (scoped to dest via active context), else create
      let destProduct = await tx.product.findFirst({
        where: { name: srcProduct.name, warehouseId: destId },
      });

      if (!destProduct) {
        // Generate a unique SKU for the cloned product in the destination warehouse
        let sku = `${srcProduct.sku}-${destId}`;
        const clash = await tx.product.findUnique({ where: { sku } });
        if (clash) sku = `${srcProduct.sku}-${destId}-${Date.now()}`;
        destProduct = await tx.product.create({
          data: {
            sku, name: srcProduct.name, description: srcProduct.description,
            categoryId: srcProduct.categoryId, unitType: srcProduct.unitType,
            quantity: 0, minThreshold: srcProduct.minThreshold,
            costPrice: srcProduct.costPrice, sellingPrice: srcProduct.sellingPrice,
            status: 'ACTIVE', warehouseId: destId,
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

    await tx.shipment.update({
      where: { id },
      data: { status: 'RECEIVED', receivedBy: req.user.id, receivedAt: new Date() },
    });
  });

  const recipients = [...(await getBossUserIds()), shipment.createdBy];
  await notify(recipients, {
    type: 'SUCCESS',
    title: `Shipment ${shipment.shipmentNumber} received`,
    message: `${shipment.destWarehouse.name} accepted the delivery from ${shipment.sourceWarehouse.name}. Stock has been updated.`,
    link: LINK,
  });

  logAudit({ userId: req.user.id, action: 'STATUS_CHANGE', module: 'INVENTORY', resourceId: id, resourceType: 'Shipment', newValues: { status: 'RECEIVED' }, req });
  res.json({ message: 'Delivery accepted and stock updated.' });
}

// ─── Decline delivery (APPROVED → DECLINED, no stock change) ────────────────────

async function declineShipment(req, res) {
  const id = Number(req.params.id);
  const { note } = req.body || {};
  const shipment = await prisma.shipment.findUnique({ where: { id }, include: { items: true, sourceWarehouse: true, destWarehouse: true } });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
  if (shipment.status !== 'APPROVED') return res.status(400).json({ message: 'Only approved shipments can be declined.' });
  if (req.warehouseId !== shipment.destWarehouseId) {
    return res.status(400).json({ message: `Switch to "${shipment.destWarehouse.name}" to act on this delivery.` });
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (shipment.stockDeducted) await restoreSourceStock(tx, shipment, req.user.id);
    return tx.shipment.update({
      where: { id },
      data: { status: 'DECLINED', receivedBy: req.user.id, receivedAt: new Date(), decisionNote: note || null, stockDeducted: false },
    });
  });

  const recipients = [...(await getBossUserIds()), shipment.createdBy];
  await notify(recipients, {
    type: 'WARNING',
    title: `Shipment ${shipment.shipmentNumber} declined`,
    message: `${shipment.destWarehouse.name} declined the delivery. Stock has been returned to ${shipment.sourceWarehouse.name}.`,
    link: LINK,
  });

  logAudit({ userId: req.user.id, action: 'STATUS_CHANGE', module: 'INVENTORY', resourceId: id, resourceType: 'Shipment', newValues: { status: 'DECLINED' }, req });
  res.json(updated);
}

// ─── Delete (only while still IN_PROCESS) ──────────────────────────────────────

async function deleteShipment(req, res) {
  const id = Number(req.params.id);
  const shipment = await prisma.shipment.findUnique({ where: { id } });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
  if (shipment.status !== 'IN_PROCESS') return res.status(400).json({ message: 'Only in-process shipments can be deleted.' });

  await prisma.shipment.delete({ where: { id } });
  logAudit({ userId: req.user.id, action: 'DELETE', module: 'INVENTORY', resourceId: id, resourceType: 'Shipment', req });
  res.json({ message: 'Shipment deleted.' });
}

module.exports = {
  listShipments, getShipment, createShipment, submitShipment,
  approveShipment, rejectShipment, receiveShipment, declineShipment, deleteShipment,
};
