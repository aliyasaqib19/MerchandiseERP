const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../utils/prisma');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { logAudit } = require('./audit.controller');

const ROLE_PERM_INCLUDE = { rolePermissions: { include: { permission: true } } };
const USER_ROLE_INCLUDE = {
  role: { include: ROLE_PERM_INCLUDE },
  extraRoles: { include: { role: { include: ROLE_PERM_INCLUDE } } },
  branch: true,
};

// Build the effective role list + unioned permissions across primary + extra roles.
function effectiveAccess(user) {
  const allRoles = [user.role, ...(user.extraRoles || []).map((er) => er.role)];
  return {
    roles: [...new Set(allRoles.map((r) => r.name))],
    permissions: [...new Set(allRoles.flatMap((r) => r.rolePermissions.map((rp) => rp.permission.name)))],
  };
}

async function login(req, res) {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
    include: USER_ROLE_INCLUDE,
  });

  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  if (user.status !== 'ACTIVE') {
    return res.status(403).json({ message: 'Your account is inactive. Contact your administrator.' });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const { roles, permissions } = effectiveAccess(user);

  const accessToken = signAccessToken({ userId: user.id, roleId: user.roleId });
  const refreshToken = signRefreshToken({ userId: user.id });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt },
  });

  logAudit({ userId: user.id, action: 'LOGIN', module: 'AUTH', resourceId: user.id, resourceType: 'User', req });

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role.name,
      roles,
      warehouseIds: user.warehouseIds || [],
      permissions,
    },
  });
}

async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token required' });
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.expiresAt < new Date()) {
    return res.status(401).json({ message: 'Refresh token expired or revoked' });
  }

  await prisma.refreshToken.delete({ where: { token: refreshToken } });

  const newAccessToken = signAccessToken({ userId: decoded.userId });
  const newRefreshToken = signRefreshToken({ userId: decoded.userId });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await prisma.refreshToken.create({
    data: { token: newRefreshToken, userId: decoded.userId, expiresAt },
  });

  res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
}

async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
  if (req.user) logAudit({ userId: req.user.id, action: 'LOGOUT', module: 'AUTH', resourceType: 'User', req });
  res.json({ message: 'Logged out successfully' });
}

async function forgotPassword(req, res) {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to prevent email enumeration
  if (!user) {
    return res.json({ message: 'If that email is registered, a reset link has been sent.' });
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { id: user.id },
    data: { rememberToken: resetToken },
  });

  // TODO: integrate email service to send resetToken
  res.json({ message: 'If that email is registered, a reset link has been sent.' });
}

async function me(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: USER_ROLE_INCLUDE,
  });

  const { roles, permissions } = effectiveAccess(user);

  res.json({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    status: user.status,
    role: user.role.name,
    roles,
    branch: user.branch?.name || null,
    warehouseIds: user.warehouseIds || [],
    permissions,
  });
}

async function updateProfile(req, res) {
  const { fullName, phone } = req.body;
  if (!fullName || fullName.trim().length < 2) {
    return res.status(400).json({ message: 'Full name must be at least 2 characters' });
  }
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { fullName: fullName.trim(), phone: phone || null },
  });
  logAudit({ userId: req.user.id, action: 'UPDATE_PROFILE', module: 'USERS', resourceId: user.id, resourceType: 'User', newValues: { fullName, phone }, req });
  res.json({ id: user.id, fullName: user.fullName, phone: user.phone, email: user.email });
}

async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Both current and new password are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters' });
  }
  const passwordRegex = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({ message: 'Password must contain at least one uppercase letter and one special character' });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return res.status(400).json({ message: 'Current password is incorrect' });
  }
  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash: hash } });
  logAudit({ userId: req.user.id, action: 'CHANGE_PASSWORD', module: 'USERS', resourceId: req.user.id, resourceType: 'User', req });
  res.json({ message: 'Password changed successfully' });
}

module.exports = { login, refresh, logout, forgotPassword, me, updateProfile, changePassword };
