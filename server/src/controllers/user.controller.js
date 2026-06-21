const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { logAudit } = require('./audit.controller');

async function getUsers(req, res) {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      role: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
}

async function getUser(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: Number(req.params.id) },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      createdAt: true,
      role: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
  });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
}

async function createUser(req, res) {
  const { fullName, email, phone, password, branchId, roleId, status } = req.body;

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
      roleId: Number(roleId),
      status: status || 'ACTIVE',
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      role: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
  });

  logAudit({ userId: req.user.id, action: 'CREATE', module: 'USERS', resourceId: user.id, resourceType: 'User', newValues: { fullName, email, roleId, status }, req });
  res.status(201).json(user);
}

async function updateUser(req, res) {
  const { fullName, phone, branchId, roleId, status } = req.body;

  const user = await prisma.user.update({
    where: { id: Number(req.params.id) },
    data: {
      fullName,
      phone,
      branchId: branchId ? Number(branchId) : null,
      roleId: roleId ? Number(roleId) : undefined,
      status,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      status: true,
      role: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
    },
  });

  logAudit({ userId: req.user.id, action: 'UPDATE', module: 'USERS', resourceId: user.id, resourceType: 'User', newValues: { fullName, phone, roleId, status }, req });
  res.json(user);
}

async function deleteUser(req, res) {
  const id = Number(req.params.id);
  if (id === req.user.id) {
    return res.status(400).json({ message: 'Cannot delete your own account' });
  }
  await prisma.user.delete({ where: { id } });
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
