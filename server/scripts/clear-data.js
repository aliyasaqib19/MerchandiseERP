/**
 * One-time script to wipe all business/transactional data via raw SQL.
 * Preserves: System admin user, Roles, Permissions, RolePermissions, Warehouses, Branches.
 * Run: node scripts/clear-data.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TABLES_IN_ORDER = [
  'audit_logs',
  'notifications',
  'document_versions',
  'documents',
  'approval_requests',
  'report_activities',
  'service_reports',
  'site_photos',
  'site_visits',
  'work_log_items',
  'work_logs',
  'project_assignments',
  'projects',
  'sale_items',
  'sales',
  'po_items',
  'purchase_orders',
  'quotation_items',
  'quotations',
  'client_transactions',
  'client_notes',
  'contacts',
  'clients',
  'shipment_items',
  'shipments',
  'inventory_transactions',
  'products',
  'brands',
  'categories',
];

async function main() {
  console.log('Clearing all business data...\n');

  for (const table of TABLES_IN_ORDER) {
    await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
    console.log(`  cleared: ${table}`);
  }

  // Delete dummy users, keep the system admin
  await prisma.$executeRawUnsafe(`DELETE FROM "refresh_tokens" WHERE "userId" != (SELECT id FROM "users" WHERE email = 'admin@inventoria.com' LIMIT 1)`);
  await prisma.$executeRawUnsafe(`DELETE FROM "user_roles" WHERE "userId" != (SELECT id FROM "users" WHERE email = 'admin@inventoria.com' LIMIT 1)`);
  await prisma.$executeRawUnsafe(`DELETE FROM "users" WHERE email != 'admin@inventoria.com'`);
  console.log('  cleared: users (kept admin@inventoria.com)');

  console.log('\nDone! Clean slate ready.');
  console.log('Login: admin@inventoria.com / Admin@12345');
}

main()
  .catch((e) => { console.error('\nError:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
