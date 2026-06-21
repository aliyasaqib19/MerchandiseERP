const prisma = require('../utils/prisma');

async function getRoles(req, res) {
  const roles = await prisma.role.findMany({
    include: {
      rolePermissions: {
        include: { permission: true },
      },
      _count: { select: { users: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  res.json(roles);
}

async function getRole(req, res) {
  const role = await prisma.role.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      rolePermissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
  });
  if (!role) return res.status(404).json({ message: 'Role not found' });
  res.json(role);
}

async function createRole(req, res) {
  const { name, description, permissionIds } = req.body;

  const role = await prisma.role.create({
    data: {
      name,
      description,
      rolePermissions: {
        create: (permissionIds || []).map((id) => ({ permissionId: Number(id) })),
      },
    },
    include: {
      rolePermissions: { include: { permission: true } },
    },
  });

  res.status(201).json(role);
}

async function updateRole(req, res) {
  const { name, description, permissionIds } = req.body;
  const roleId = Number(req.params.id);

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return res.status(404).json({ message: 'Role not found' });

  const updated = await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.role.update({
      where: { id: roleId },
      data: {
        name,
        description,
        rolePermissions: {
          create: (permissionIds || []).map((id) => ({ permissionId: Number(id) })),
        },
      },
      include: { rolePermissions: { include: { permission: true } } },
    }),
  ]);

  res.json(updated[1]);
}

async function deleteRole(req, res) {
  const roleId = Number(req.params.id);
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return res.status(404).json({ message: 'Role not found' });
  if (role.isSystem) return res.status(400).json({ message: 'Cannot delete a system role' });

  const usersWithRole = await prisma.user.count({ where: { roleId } });
  if (usersWithRole > 0) {
    return res.status(400).json({ message: 'Cannot delete a role that is assigned to users' });
  }

  await prisma.role.delete({ where: { id: roleId } });
  res.json({ message: 'Role deleted' });
}

module.exports = { getRoles, getRole, createRole, updateRole, deleteRole };
