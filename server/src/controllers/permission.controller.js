const prisma = require('../utils/prisma');

async function getPermissions(req, res) {
  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { action: 'asc' }],
  });

  // Group by module for easier frontend consumption
  const grouped = permissions.reduce((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  res.json({ permissions, grouped });
}

module.exports = { getPermissions };
