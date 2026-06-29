require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PERMISSIONS = [
  { name: 'INVENTORY_VIEW',    displayName: 'View Inventory',            module: 'INVENTORY',  action: 'VIEW' },
  { name: 'INVENTORY_CREATE',  displayName: 'Add Inventory',             module: 'INVENTORY',  action: 'CREATE' },
  { name: 'INVENTORY_UPDATE',  displayName: 'Edit Inventory',            module: 'INVENTORY',  action: 'UPDATE' },
  { name: 'INVENTORY_DELETE',  displayName: 'Delete Inventory',          module: 'INVENTORY',  action: 'DELETE' },
  { name: 'INVENTORY_EXPORT',  displayName: 'Export Inventory',          module: 'INVENTORY',  action: 'EXPORT' },
  { name: 'SHIPMENTS_VIEW',    displayName: 'View Shipments',            module: 'INVENTORY',  action: 'VIEW' },
  { name: 'SHIPMENTS_CREATE',  displayName: 'Create Shipment & Details', module: 'INVENTORY',  action: 'CREATE' },
  { name: 'SHIPMENTS_APPROVE', displayName: 'Approve/Decline Shipment',  module: 'INVENTORY',  action: 'APPROVE' },
  { name: 'SHIPMENTS_RECEIVE', displayName: 'Receive Shipment',          module: 'INVENTORY',  action: 'UPDATE' },
  { name: 'CLIENTS_VIEW',      displayName: 'View Clients',              module: 'CLIENTS',    action: 'VIEW' },
  { name: 'CLIENTS_CREATE',    displayName: 'Add Clients',               module: 'CLIENTS',    action: 'CREATE' },
  { name: 'CLIENTS_UPDATE',    displayName: 'Edit Clients',              module: 'CLIENTS',    action: 'UPDATE' },
  { name: 'CLIENTS_DELETE',    displayName: 'Delete Clients',            module: 'CLIENTS',    action: 'DELETE' },
  { name: 'SALES_VIEW',        displayName: 'View Sales',                module: 'SALES',      action: 'VIEW' },
  { name: 'SALES_CREATE',      displayName: 'Create Sales',              module: 'SALES',      action: 'CREATE' },
  { name: 'SALES_UPDATE',      displayName: 'Edit Sales',                module: 'SALES',      action: 'UPDATE' },
  { name: 'SALES_APPROVE',     displayName: 'Approve Sales',             module: 'SALES',      action: 'APPROVE' },
  { name: 'SALES_EXPORT',      displayName: 'Export Sales',              module: 'SALES',      action: 'EXPORT' },
  { name: 'PROJECTS_VIEW',     displayName: 'View Projects',             module: 'PROJECTS',   action: 'VIEW' },
  { name: 'PROJECTS_CREATE',   displayName: 'Add Projects',              module: 'PROJECTS',   action: 'CREATE' },
  { name: 'PROJECTS_UPDATE',   displayName: 'Edit Projects',             module: 'PROJECTS',   action: 'UPDATE' },
  { name: 'PROJECTS_DELETE',   displayName: 'Delete Projects',           module: 'PROJECTS',   action: 'DELETE' },
  { name: 'PROJECTS_APPROVE',  displayName: 'Approve Projects',          module: 'PROJECTS',   action: 'APPROVE' },
  { name: 'FINANCE_VIEW',      displayName: 'View Finance',              module: 'FINANCE',    action: 'VIEW' },
  { name: 'FINANCE_CREATE',    displayName: 'Create Finance',            module: 'FINANCE',    action: 'CREATE' },
  { name: 'FINANCE_APPROVE',   displayName: 'Approve Finance',           module: 'FINANCE',    action: 'APPROVE' },
  { name: 'FINANCE_EXPORT',    displayName: 'Export Finance',            module: 'FINANCE',    action: 'EXPORT' },
  { name: 'USERS_VIEW',        displayName: 'View Users',                module: 'USERS',      action: 'VIEW' },
  { name: 'USERS_CREATE',      displayName: 'Create Users',              module: 'USERS',      action: 'CREATE' },
  { name: 'USERS_UPDATE',      displayName: 'Edit Users',                module: 'USERS',      action: 'UPDATE' },
  { name: 'USERS_DELETE',      displayName: 'Delete Users',              module: 'USERS',      action: 'DELETE' },
  { name: 'ROLES_VIEW',        displayName: 'View Roles',                module: 'ROLES',      action: 'VIEW' },
  { name: 'ROLES_CREATE',      displayName: 'Create Roles',              module: 'ROLES',      action: 'CREATE' },
  { name: 'ROLES_UPDATE',      displayName: 'Edit Roles',                module: 'ROLES',      action: 'UPDATE' },
  { name: 'ROLES_DELETE',      displayName: 'Delete Roles',              module: 'ROLES',      action: 'DELETE' },
  { name: 'SETTINGS_VIEW',     displayName: 'View Settings',             module: 'SETTINGS',   action: 'VIEW' },
  { name: 'SETTINGS_UPDATE',   displayName: 'Update Settings',           module: 'SETTINGS',   action: 'UPDATE' },
  { name: 'APPROVALS_VIEW',    displayName: 'View Approvals',            module: 'APPROVALS',  action: 'VIEW' },
  { name: 'APPROVALS_CREATE',  displayName: 'Submit Approvals',          module: 'APPROVALS',  action: 'CREATE' },
  { name: 'APPROVALS_APPROVE', displayName: 'Approve/Reject',            module: 'APPROVALS',  action: 'APPROVE' },
  { name: 'DOCUMENTS_VIEW',    displayName: 'View Documents',            module: 'DOCUMENTS',  action: 'VIEW' },
  { name: 'DOCUMENTS_CREATE',  displayName: 'Upload Documents',          module: 'DOCUMENTS',  action: 'CREATE' },
  { name: 'DOCUMENTS_DELETE',  displayName: 'Delete Documents',          module: 'DOCUMENTS',  action: 'DELETE' },
  { name: 'AUDIT_VIEW',        displayName: 'View Audit Logs',           module: 'AUDIT',      action: 'VIEW' },
  { name: 'REPORTS_VIEW',      displayName: 'View Reports',              module: 'REPORTS',    action: 'VIEW' },
  { name: 'REPORTS_EXPORT',    displayName: 'Export Reports',            module: 'REPORTS',    action: 'EXPORT' },
];

async function main() {
  console.log('Seeding permissions...');
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({ where: { name: perm.name }, update: {}, create: perm });
  }

  console.log('Seeding System Administrator role...');
  const adminRole = await prisma.role.upsert({
    where: { name: 'System Administrator' },
    update: {},
    create: { name: 'System Administrator', description: 'Full access to all modules', isSystem: true },
  });

  const allPerms = await prisma.permission.findMany();
  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }

  console.log('Seeding default branch...');
  const branch = await prisma.branch.upsert({
    where: { name: 'Head Office' },
    update: {},
    create: { name: 'Head Office', location: 'Main Location' },
  });

  console.log('Seeding admin user...');
  const passwordHash = await bcrypt.hash('Admin@12345', 12);
  await prisma.user.upsert({
    where: { email: 'admin@inventoria.com' },
    update: {},
    create: {
      fullName: 'System Administrator',
      email: 'admin@inventoria.com',
      passwordHash,
      branchId: branch.id,
      roleId: adminRole.id,
      status: 'ACTIVE',
    },
  });

  console.log('Seeding warehouses...');
  await prisma.warehouse.upsert({
    where: { name: 'Karachi Warehouse' },
    update: {},
    create: {
      name: 'Karachi Warehouse',
      city: 'Karachi',
      address: 'Karachi',
      status: 'ACTIVE',
    },
  });

  await prisma.warehouse.upsert({
    where: { name: 'Lahore Warehouse' },
    update: {},
    create: {
      name: 'Lahore Warehouse',
      city: 'Lahore',
      address: 'Lahore',
      status: 'ACTIVE',
    },
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
