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

    // Strict warehouse access control: a user restricted to specific warehouses
    // may not read or write data for any other warehouse. Empty list = all access.
    const allowed = user.warehouseIds || [];
    if (allowed.length > 0 && req.warehouseId != null && !allowed.includes(req.warehouseId)) {
      return res.status(403).json({ message: 'You do not have access to this warehouse' });
    }

    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = authenticate;
