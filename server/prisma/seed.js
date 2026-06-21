require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PERMISSIONS = [
  // Inventory
  { name: 'INVENTORY_VIEW',   displayName: 'View Inventory',   module: 'INVENTORY', action: 'VIEW' },
  { name: 'INVENTORY_CREATE', displayName: 'Add Inventory',    module: 'INVENTORY', action: 'CREATE' },
  { name: 'INVENTORY_UPDATE', displayName: 'Edit Inventory',   module: 'INVENTORY', action: 'UPDATE' },
  { name: 'INVENTORY_DELETE', displayName: 'Delete Inventory', module: 'INVENTORY', action: 'DELETE' },
  { name: 'INVENTORY_EXPORT', displayName: 'Export Inventory', module: 'INVENTORY', action: 'EXPORT' },
  // Clients
  { name: 'CLIENTS_VIEW',   displayName: 'View Clients',   module: 'CLIENTS', action: 'VIEW' },
  { name: 'CLIENTS_CREATE', displayName: 'Add Clients',    module: 'CLIENTS', action: 'CREATE' },
  { name: 'CLIENTS_UPDATE', displayName: 'Edit Clients',   module: 'CLIENTS', action: 'UPDATE' },
  { name: 'CLIENTS_DELETE', displayName: 'Delete Clients', module: 'CLIENTS', action: 'DELETE' },
  // Sales
  { name: 'SALES_VIEW',    displayName: 'View Sales',    module: 'SALES', action: 'VIEW' },
  { name: 'SALES_CREATE',  displayName: 'Create Sales',  module: 'SALES', action: 'CREATE' },
  { name: 'SALES_UPDATE',  displayName: 'Edit Sales',    module: 'SALES', action: 'UPDATE' },
  { name: 'SALES_APPROVE', displayName: 'Approve Sales', module: 'SALES', action: 'APPROVE' },
  { name: 'SALES_EXPORT',  displayName: 'Export Sales',  module: 'SALES', action: 'EXPORT' },
  // Projects
  { name: 'PROJECTS_VIEW',    displayName: 'View Projects',    module: 'PROJECTS', action: 'VIEW' },
  { name: 'PROJECTS_CREATE',  displayName: 'Add Projects',     module: 'PROJECTS', action: 'CREATE' },
  { name: 'PROJECTS_UPDATE',  displayName: 'Edit Projects',    module: 'PROJECTS', action: 'UPDATE' },
  { name: 'PROJECTS_DELETE',  displayName: 'Delete Projects',  module: 'PROJECTS', action: 'DELETE' },
  { name: 'PROJECTS_APPROVE', displayName: 'Approve Projects', module: 'PROJECTS', action: 'APPROVE' },
  // Finance
  { name: 'FINANCE_VIEW',    displayName: 'View Finance',    module: 'FINANCE', action: 'VIEW' },
  { name: 'FINANCE_CREATE',  displayName: 'Create Finance',  module: 'FINANCE', action: 'CREATE' },
  { name: 'FINANCE_APPROVE', displayName: 'Approve Finance', module: 'FINANCE', action: 'APPROVE' },
  { name: 'FINANCE_EXPORT',  displayName: 'Export Finance',  module: 'FINANCE', action: 'EXPORT' },
  // Users
  { name: 'USERS_VIEW',   displayName: 'View Users',   module: 'USERS', action: 'VIEW' },
  { name: 'USERS_CREATE', displayName: 'Create Users', module: 'USERS', action: 'CREATE' },
  { name: 'USERS_UPDATE', displayName: 'Edit Users',   module: 'USERS', action: 'UPDATE' },
  { name: 'USERS_DELETE', displayName: 'Delete Users', module: 'USERS', action: 'DELETE' },
  // Roles
  { name: 'ROLES_VIEW',   displayName: 'View Roles',   module: 'ROLES', action: 'VIEW' },
  { name: 'ROLES_CREATE', displayName: 'Create Roles', module: 'ROLES', action: 'CREATE' },
  { name: 'ROLES_UPDATE', displayName: 'Edit Roles',   module: 'ROLES', action: 'UPDATE' },
  { name: 'ROLES_DELETE', displayName: 'Delete Roles', module: 'ROLES', action: 'DELETE' },
  // Settings
  { name: 'SETTINGS_VIEW',   displayName: 'View Settings',   module: 'SETTINGS', action: 'VIEW' },
  { name: 'SETTINGS_UPDATE', displayName: 'Update Settings', module: 'SETTINGS', action: 'UPDATE' },
  // Approvals
  { name: 'APPROVALS_VIEW',   displayName: 'View Approvals',   module: 'APPROVALS', action: 'VIEW' },
  { name: 'APPROVALS_CREATE', displayName: 'Submit Approvals', module: 'APPROVALS', action: 'CREATE' },
  { name: 'APPROVALS_APPROVE',displayName: 'Approve/Reject',   module: 'APPROVALS', action: 'APPROVE' },
  // Documents
  { name: 'DOCUMENTS_VIEW',   displayName: 'View Documents',   module: 'DOCUMENTS', action: 'VIEW' },
  { name: 'DOCUMENTS_CREATE', displayName: 'Upload Documents', module: 'DOCUMENTS', action: 'CREATE' },
  { name: 'DOCUMENTS_DELETE', displayName: 'Delete Documents', module: 'DOCUMENTS', action: 'DELETE' },
  // Audit
  { name: 'AUDIT_VIEW',       displayName: 'View Audit Logs',  module: 'AUDIT', action: 'VIEW' },
  // Reports
  { name: 'REPORTS_VIEW',     displayName: 'View Reports',     module: 'REPORTS', action: 'VIEW' },
  { name: 'REPORTS_EXPORT',   displayName: 'Export Reports',   module: 'REPORTS', action: 'EXPORT' },
];

async function main() {
  console.log('Seeding permissions...');
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }

  console.log('Seeding system roles...');
  const allPermNames = PERMISSIONS.map((p) => p.name);

  const adminRole = await prisma.role.upsert({
    where: { name: 'System Administrator' },
    update: {},
    create: {
      name: 'System Administrator',
      description: 'Full access to all modules',
      isSystem: true,
    },
  });

  // Attach all permissions to admin role
  const allPerms = await prisma.permission.findMany();
  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }

  const regionalManagerRole = await prisma.role.upsert({
    where: { name: 'Regional Manager' },
    update: {},
    create: {
      name: 'Regional Manager',
      description: 'Manages regions, users, and roles',
      isSystem: true,
    },
  });

  const rmPermissions = [
    'USERS_VIEW', 'USERS_CREATE', 'USERS_UPDATE', 'USERS_DELETE',
    'ROLES_VIEW', 'ROLES_CREATE', 'ROLES_UPDATE', 'ROLES_DELETE',
    'INVENTORY_VIEW', 'CLIENTS_VIEW', 'SALES_VIEW', 'SALES_APPROVE',
    'PROJECTS_VIEW', 'FINANCE_VIEW', 'FINANCE_APPROVE',
    'APPROVALS_VIEW', 'APPROVALS_CREATE', 'APPROVALS_APPROVE',
    'DOCUMENTS_VIEW', 'DOCUMENTS_CREATE', 'DOCUMENTS_DELETE',
    'AUDIT_VIEW', 'REPORTS_VIEW', 'REPORTS_EXPORT',
  ];
  for (const permName of rmPermissions) {
    const perm = await prisma.permission.findUnique({ where: { name: permName } });
    if (perm) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: regionalManagerRole.id, permissionId: perm.id } },
        update: {},
        create: { roleId: regionalManagerRole.id, permissionId: perm.id },
      });
    }
  }

  await prisma.role.upsert({
    where: { name: 'Technician' },
    update: {},
    create: {
      name: 'Technician',
      description: 'Field technician with project access',
      isSystem: true,
    },
  });

  await prisma.role.upsert({
    where: { name: 'Sales Manager' },
    update: {},
    create: {
      name: 'Sales Manager',
      description: 'Manages sales and clients',
      isSystem: true,
    },
  });

  console.log('Seeding default branch...');
  const branch = await prisma.branch.upsert({
    where: { name: 'Head Office' },
    update: {},
    create: { name: 'Head Office', location: 'Main Location' },
  });

  console.log('Seeding super admin user...');
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

  // ── Inventory: Categories ──────────────────────────────────────────────────
  console.log('Seeding inventory categories...');
  const CATEGORIES = [
    { name: 'Cables & Wiring',          description: 'All types of cables, wires and conductors' },
    { name: 'Fiber Optics',             description: 'Fiber optic cables, connectors and accessories' },
    { name: 'Network Equipment',        description: 'Switches, routers, patch panels and network gear' },
    { name: 'Conduits & Accessories',   description: 'PVC and metal conduits, cable trays and fittings' },
    { name: 'Tools & Equipment',        description: 'Hand tools, power tools and testing equipment' },
    { name: 'Electrical Components',    description: 'Breakers, connectors, terminals and electrical parts' },
    { name: 'Safety & PPE',             description: 'Personal protective equipment and safety gear' },
  ];

  const categoryMap = {};
  for (const cat of CATEGORIES) {
    const c = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    categoryMap[cat.name] = c.id;
  }

  // ── Inventory: Products ────────────────────────────────────────────────────
  console.log('Seeding inventory products...');

  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@inventoria.com' } });

  const PRODUCTS = [
    { sku: 'CAB-UTP-CAT6-305', name: 'UTP Cable Cat6 (305m Box)', categoryId: categoryMap['Cables & Wiring'], unitType: 'BOX', quantity: 45, minThreshold: 10, costPrice: 85, sellingPrice: 120 },
    { sku: 'CAB-UTP-CAT6A-305', name: 'UTP Cable Cat6A (305m Box)', categoryId: categoryMap['Cables & Wiring'], unitType: 'BOX', quantity: 20, minThreshold: 5, costPrice: 140, sellingPrice: 195 },
    { sku: 'CAB-FIB-SM-500', name: 'Fiber Cable Single-Mode OS2 (500m)', categoryId: categoryMap['Fiber Optics'], unitType: 'ROLL', quantity: 8, minThreshold: 3, costPrice: 320, sellingPrice: 450 },
    { sku: 'CAB-FIB-MM-300', name: 'Fiber Cable Multi-Mode OM3 (300m)', categoryId: categoryMap['Fiber Optics'], unitType: 'ROLL', quantity: 2, minThreshold: 3, costPrice: 280, sellingPrice: 390 },
    { sku: 'NET-SW-24P-GIG', name: 'Managed Switch 24-Port Gigabit', categoryId: categoryMap['Network Equipment'], unitType: 'PIECE', quantity: 12, minThreshold: 2, costPrice: 850, sellingPrice: 1200 },
    { sku: 'NET-SW-48P-GIG', name: 'Managed Switch 48-Port Gigabit', categoryId: categoryMap['Network Equipment'], unitType: 'PIECE', quantity: 5, minThreshold: 2, costPrice: 1400, sellingPrice: 1950 },
    { sku: 'NET-PATCH-PAN-24', name: 'Patch Panel 24-Port Cat6', categoryId: categoryMap['Network Equipment'], unitType: 'PIECE', quantity: 18, minThreshold: 5, costPrice: 95, sellingPrice: 140 },
    { sku: 'CON-PVC-20MM-3M', name: 'PVC Conduit 20mm (3m)', categoryId: categoryMap['Conduits & Accessories'], unitType: 'PIECE', quantity: 200, minThreshold: 50, costPrice: 3.5, sellingPrice: 6 },
    { sku: 'CON-TRAY-100-2M', name: 'Cable Tray 100mm (2m)', categoryId: categoryMap['Conduits & Accessories'], unitType: 'PIECE', quantity: 1, minThreshold: 20, costPrice: 22, sellingPrice: 38 },
    { sku: 'TOOL-CRIMP-RJ45', name: 'RJ45 Crimping Tool', categoryId: categoryMap['Tools & Equipment'], unitType: 'PIECE', quantity: 8, minThreshold: 3, costPrice: 45, sellingPrice: 75 },
    { sku: 'TOOL-OTDR-SM', name: 'OTDR Tester Single-Mode', categoryId: categoryMap['Tools & Equipment'], unitType: 'PIECE', quantity: 2, minThreshold: 1, costPrice: 2800, sellingPrice: 3800 },
    { sku: 'ELE-BREAKER-20A', name: 'Circuit Breaker 20A', categoryId: categoryMap['Electrical Components'], unitType: 'PIECE', quantity: 35, minThreshold: 10, costPrice: 18, sellingPrice: 32 },
    { sku: 'SAFE-HELMET-HARD', name: 'Safety Hard Hat', categoryId: categoryMap['Safety & PPE'], unitType: 'PIECE', quantity: 15, minThreshold: 5, costPrice: 25, sellingPrice: 45 },
    { sku: 'SAFE-GLOVES-L', name: 'Safety Gloves (Large)', categoryId: categoryMap['Safety & PPE'], unitType: 'SET', quantity: 40, minThreshold: 10, costPrice: 12, sellingPrice: 22 },
  ];

  for (const p of PRODUCTS) {
    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (!existing) {
      const product = await prisma.product.create({ data: p });
      // Initial stock transaction
      if (p.quantity > 0 && adminUser) {
        await prisma.inventoryTransaction.create({
          data: {
            productId: product.id,
            type: 'STOCK_IN',
            quantity: p.quantity,
            balanceAfter: p.quantity,
            notes: 'Initial stock — seed data',
            createdBy: adminUser.id,
          },
        });
      }
    }
  }

  // ── CRM: Clients ──────────────────────────────────────────────────────────
  console.log('Seeding CRM clients...');

  const admin = await prisma.user.findUnique({ where: { email: 'admin@inventoria.com' } });
  if (!admin) { console.log('Admin not found, skipping CRM seed'); return; }

  const CLIENTS = [
    {
      companyName: 'Gulf Telecom Solutions',
      industry: 'Telecommunications',
      email: 'info@gulftelcom.ae',
      phone: '+971 4 234 5678',
      mobile: '+971 50 123 4567',
      website: 'www.gulftelcom.ae',
      address: 'Business Bay, Tower 3, Floor 12',
      city: 'Dubai',
      country: 'UAE',
      taxNumber: 'TRN-100234567',
      creditLimit: 50000,
      status: 'ACTIVE',
      contacts: [
        { fullName: 'Ahmed Al-Rashidi', title: 'Procurement Manager', email: 'ahmed@gulftelcom.ae', phone: '+971 50 111 2233', isPrimary: true },
        { fullName: 'Sara Khalid',       title: 'Finance Director',    email: 'sara@gulftelcom.ae',  phone: '+971 50 222 3344', isPrimary: false },
      ],
      transactions: [
        { type: 'INVOICE', amount: 28500, description: 'Invoice #INV-0001 – Network cabling project Phase 1', reference: 'INV-0001', daysAgo: 60 },
        { type: 'PAYMENT', amount: 28500, description: 'Payment received – INV-0001',                          reference: 'PAY-0001', daysAgo: 45 },
        { type: 'INVOICE', amount: 42000, description: 'Invoice #INV-0018 – Fiber backbone installation',     reference: 'INV-0018', daysAgo: 20 },
        { type: 'PAYMENT', amount: 20000, description: 'Partial payment – INV-0018',                          reference: 'PAY-0012', daysAgo: 10 },
      ],
    },
    {
      companyName: 'Al-Barakah Contracting LLC',
      industry: 'Construction',
      email: 'projects@albarakah.com',
      phone: '+971 3 456 7890',
      mobile: '+971 55 987 6543',
      website: 'www.albarakah.com',
      address: 'Industrial Area, Block 7',
      city: 'Abu Dhabi',
      country: 'UAE',
      taxNumber: 'TRN-200345678',
      creditLimit: 75000,
      status: 'ACTIVE',
      contacts: [
        { fullName: 'Khalid Ibrahim',   title: 'CEO',                 email: 'khalid@albarakah.com',  phone: '+971 55 100 2200', isPrimary: true },
        { fullName: 'Nour Al-Mansouri', title: 'Project Coordinator', email: 'nour@albarakah.com',    phone: '+971 55 300 4400', isPrimary: false },
      ],
      transactions: [
        { type: 'INVOICE', amount: 65000, description: 'Invoice #INV-0005 – Full site electrical works', reference: 'INV-0005', daysAgo: 90 },
        { type: 'PAYMENT', amount: 40000, description: 'Partial payment – INV-0005',                     reference: 'PAY-0003', daysAgo: 70 },
        { type: 'PAYMENT', amount: 25000, description: 'Final payment – INV-0005',                       reference: 'PAY-0005', daysAgo: 55 },
        { type: 'INVOICE', amount: 18000, description: 'Invoice #INV-0021 – CCTV installation',          reference: 'INV-0021', daysAgo: 15 },
      ],
    },
    {
      companyName: 'Emirates Networks LLC',
      industry: 'Technology',
      email: 'procurement@emiratesnet.com',
      phone: '+971 4 678 9012',
      mobile: '+971 52 456 7890',
      city: 'Dubai',
      country: 'UAE',
      creditLimit: 100000,
      status: 'ACTIVE',
      contacts: [
        { fullName: 'Fatima Al-Zaabi', title: 'IT Director', email: 'fatima@emiratesnet.com', phone: '+971 52 500 6600', isPrimary: true },
      ],
      transactions: [
        { type: 'INVOICE', amount: 34200, description: 'Invoice #INV-0009 – Network equipment supply', reference: 'INV-0009', daysAgo: 30 },
      ],
    },
    {
      companyName: 'Noor Education Group',
      industry: 'Education',
      email: 'facilities@nooredu.ae',
      phone: '+971 6 234 5678',
      mobile: '+971 56 789 0123',
      city: 'Sharjah',
      country: 'UAE',
      creditLimit: 30000,
      status: 'ACTIVE',
      contacts: [
        { fullName: 'Mohammad Al-Noor', title: 'Facilities Manager', email: 'mohammad@nooredu.ae', phone: '+971 56 100 1100', isPrimary: true },
      ],
      transactions: [
        { type: 'INVOICE', amount: 12500, description: 'Invoice #INV-0012 – Campus Wi-Fi infrastructure', reference: 'INV-0012', daysAgo: 25 },
        { type: 'PAYMENT', amount: 12500, description: 'Full payment – INV-0012',                          reference: 'PAY-0008', daysAgo: 12 },
      ],
    },
    {
      companyName: 'Horizon Real Estate',
      industry: 'Real Estate',
      email: 'ops@horizonre.ae',
      phone: '+971 4 890 1234',
      mobile: '+971 50 234 5678',
      city: 'Dubai',
      country: 'UAE',
      status: 'PROSPECT',
      contacts: [
        { fullName: 'Layla Hassan', title: 'Operations Director', email: 'layla@horizonre.ae', phone: '+971 50 700 8800', isPrimary: true },
      ],
      transactions: [],
    },
  ];

  for (const clientData of CLIENTS) {
    const { contacts, transactions, ...clientBody } = clientData;
    const existing = await prisma.client.findFirst({ where: { companyName: clientBody.companyName } });
    if (existing) continue;

    const client = await prisma.client.create({
      data: { ...clientBody, createdBy: admin.id },
    });

    for (const c of contacts) {
      await prisma.contact.create({ data: { ...c, clientId: client.id } });
    }

    for (const t of transactions) {
      const { daysAgo, ...txBody } = t;
      const txDate = new Date();
      txDate.setDate(txDate.getDate() - daysAgo);
      await prisma.clientTransaction.create({
        data: { ...txBody, clientId: client.id, date: txDate, createdBy: admin.id },
      });
    }

    // Seed a note
    await prisma.clientNote.create({
      data: {
        clientId: client.id,
        note: `Initial client profile created. Status: ${clientBody.status}.`,
        createdBy: admin.id,
      },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
