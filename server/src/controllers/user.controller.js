const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { logAudit } = require('./audit.controller');

const USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  status: true,
  warehouseIds: true,
  createdAt: true,
  role: { select: { id: true, name: true } },
  extraRoles: { select: { role: { select: { id: true, name: true } } } },
  branch: { select: { id: true, name: true } },
};

// Flatten primary role + extra roles into `roles` and `roleIds` for the client.
function shapeUser(u) {
  if (!u) return u;
  const extra = (u.extraRoles || []).map((er) => er.role);
  const allRoles = [u.role, ...extra].filter(Boolean);
  // de-dupe by id, primary first
  const seen = new Set();
  const roles = [];
  for (const r of allRoles) {
    if (!seen.has(r.id)) { seen.add(r.id); roles.push(r); }
  }
  const { extraRoles, ...rest } = u;
  return { ...rest, roles, roleIds: roles.map((r) => r.id) };
}

// Normalize a roleIds payload → { primary, extras[] }. Falls back to legacy roleId.
function normalizeRoleIds(body) {
  let ids = Array.isArray(body.roleIds) ? body.roleIds.map(Number).filter((n) => !Number.isNaN(n)) : [];
  if (ids.length === 0 && body.roleId) ids = [Number(body.roleId)];
  ids = [...new Set(ids)];
  return { primary: ids[0], extras: ids.slice(1) };
}

async function getUsers(req, res) {
  const users = await prisma.user.findMany({
    select: USER_SELECT,
    orderBy: { createdAt: 'desc' },
  });
  res.json(users.map(shapeUser));
}

async function getUser(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: Number(req.params.id) },
    select: USER_SELECT,
  });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(shapeUser(user));
}

async function createUser(req, res) {
  const { fullName, email, phone, password, branchId, status, warehouseIds } = req.body;
  const { primary, extras } = normalizeRoleIds(req.body);
  if (!primary) return res.status(400).json({ message: 'At least one role is required' });

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return res.status(409).json({ message: 'Email already in use' });

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      phone,
      passwordHash,
      branchId: branchId ? Number(branchId) : null,
      roleId: primary,
      status: status || 'ACTIVE',
      warehouseIds: Array.isArray(warehouseIds) ? warehouseIds.map(Number) : [],
      extraRoles: extras.length ? { create: extras.map((roleId) => ({ roleId })) } : undefined,
    },
    select: USER_SELECT,
  });

  logAudit({ userId: req.user.id, action: 'CREATE', module: 'USERS', resourceId: user.id, resourceType: 'User', newValues: { fullName, email, roleIds: [primary, ...extras], status }, req });
  res.status(201).json(shapeUser(user));
}

async function updateUser(req, res) {
  const { fullName, phone, branchId, status, warehouseIds } = req.body;
  const id = Number(req.params.id);
  const rolesProvided = Array.isArray(req.body.roleIds) || req.body.roleId !== undefined;
  const { primary, extras } = normalizeRoleIds(req.body);
  if (rolesProvided && !primary) return res.status(400).json({ message: 'At least one role is required' });

  const user = await prisma.$transaction(async (tx) => {
    if (rolesProvided) {
      // Replace the full set of extra roles with the new selection.
      await tx.userRole.deleteMany({ where: { userId: id } });
    }
    return tx.user.update({
      where: { id },
      data: {
        fullName,
        phone,
        branchId: branchId ? Number(branchId) : null,
        roleId: rolesProvided ? primary : undefined,
        status,
        warehouseIds: Array.isArray(warehouseIds) ? warehouseIds.map(Number) : undefined,
        extraRoles: rolesProvided && extras.length ? { create: extras.map((roleId) => ({ roleId })) } : undefined,
      },
      select: USER_SELECT,
    });
  });

  logAudit({ userId: req.user.id, action: 'UPDATE', module: 'USERS', resourceId: user.id, resourceType: 'User', newValues: { fullName, phone, roleIds: rolesProvided ? [primary, ...extras] : undefined, status }, req });
  res.json(shapeUser(user));
}

async function deleteUser(req, res) {
  const id = Number(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ message: 'Cannot delete your own account' });
  }
  try {
    await prisma.base.refreshToken.deleteMany({ where: { userId: id } });
    await prisma.base.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
    try { await prisma.base.userRole.deleteMany({ where: { userId: id } }); } catch (_) {}
    await prisma.base.user.delete({ where: { id } });
  } catch (e) {
    console.error('[deleteUser] failed:', e.message);
    throw e;
  }
  logAudit({ userId: req.user.id, action: 'DELETE', module: 'USERS', resourceId: id, resourceType: 'User', req });
  res.json({ message: 'User deleted' });
}

async function resetUserPassword(req, res) {
  const { password } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: Number(req.params.id) },
    data: { passwordHash },
  });
  logAudit({ userId: req.user.id, action: 'RESET_PASSWORD', module: 'USERS', resourceId: Number(req.params.id), resourceType: 'User', req });
  res.json({ message: 'Password reset successfully' });
}

module.exports = { getUsers, getUser, createUser, updateUser, deleteUser, resetUserPassword };
