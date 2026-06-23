const { verifyAccessToken } = require('../utils/jwt');
const prisma = require('../utils/prisma');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    const rolePermInclude = { rolePermissions: { include: { permission: true } } };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        role: { include: rolePermInclude },
        extraRoles: { include: { role: { include: rolePermInclude } } },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    // Effective permissions & roles = union of the primary role and all extra roles.
    const allRoles = [user.role, ...user.extraRoles.map((er) => er.role)];
    const roleNames = [...new Set(allRoles.map((r) => r.name))];
    const permissions = [...new Set(allRoles.flatMap((r) => r.rolePermissions.map((rp) => rp.permission.name)))];

    req.user = {
      id: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
      roleNames,
      warehouseIds: user.warehouseIds || [],
      permissions,
    };

    // Warehouse access: a user assigned to specific warehouses has FULL access
    // (per their role permissions) in those warehouses, and VIEW-ONLY access in
    // every other warehouse. Empty list = full access everywhere (Admin / Boss).
    // System Administrator bypasses this entirely.
    const allowed = user.warehouseIds || [];
    const isAdmin = roleNames.includes('System Administrator');
    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (
      !isAdmin &&
      allowed.length > 0 &&
      req.warehouseId != null &&
      !allowed.includes(req.warehouseId) &&
      isWrite
    ) {
      return res.status(403).json({
        message: 'View-only: you can view this warehouse but cannot modify it. Switch to your assigned warehouse to make changes.',
      });
    }

    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = authenticate;
