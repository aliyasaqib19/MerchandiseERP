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
  // Shipments
  { name: 'SHIPMENTS_VIEW',    displayName: 'View Shipments',           module: 'INVENTORY', action: 'VIEW' },
  { name: 'SHIPMENTS_CREATE',  displayName: 'Create Shipment & Details', module: 'INVENTORY', action: 'CREATE' },
  { name: 'SHIPMENTS_APPROVE', displayName: 'Approve/Decline Shipment',  module: 'INVENTORY', action: 'APPROVE' },
  { name: 'SHIPMENTS_RECEIVE', displayName: 'Receive Shipment',          module: 'INVENTORY', action: 'UPDATE' },
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

  // ── Shipment workflow roles ───────────────────────────────────────────────
  console.log('Seeding shipment workflow roles...');
  async function ensureRole(name, description) {
    return prisma.role.upsert({ where: { name }, update: {}, create: { name, description, isSystem: true } });
  }
  async function assignPerms(role, permNames) {
    for (const permName of permNames) {
      const perm = await prisma.permission.findUnique({ where: { name: permName } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    }
  }

  const bossRole = await ensureRole('Boss', 'Approves shipments and reviews requests');
  await assignPerms(bossRole, [
    'INVENTORY_VIEW', 'SHIPMENTS_VIEW', 'SHIPMENTS_APPROVE', 'SHIPMENTS_RECEIVE',
    'APPROVALS_VIEW', 'APPROVALS_APPROVE', 'CLIENTS_VIEW', 'SALES_VIEW',
    'REPORTS_VIEW', 'AUDIT_VIEW', 'NOTIFICATIONS_VIEW',
  ]);

  const inventoryManagerRole = await ensureRole('Inventory Manager', 'Creates shipments and adds shipment details');
  await assignPerms(inventoryManagerRole, [
    'INVENTORY_VIEW', 'INVENTORY_CREATE', 'INVENTORY_UPDATE', 'INVENTORY_EXPORT',
    'SHIPMENTS_VIEW', 'SHIPMENTS_CREATE', 'SHIPMENTS_RECEIVE', 'CLIENTS_VIEW', 'NOTIFICATIONS_VIEW',
  ]);

  const warehouseStaffRole = await ensureRole('Warehouse Staff', 'Receives incoming shipments at the destination warehouse');
  await assignPerms(warehouseStaffRole, [
    'INVENTORY_VIEW', 'SHIPMENTS_VIEW', 'SHIPMENTS_RECEIVE', 'NOTIFICATIONS_VIEW',
  ]);

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

  // ── Warehouses ────────────────────────────────────────────────────────────
  console.log('Seeding warehouses...');
  const warehouseKarachi = await prisma.warehouse.upsert({
    where: { name: 'Karachi Warehouse' },
    update: {},
    create: {
      name: 'Karachi Warehouse',
      city: 'Karachi',
      address: 'Plot 45, SITE Industrial Area, Karachi',
      contactPerson: 'Imran Siddiqui',
      phone: '+92 21 3456 7890',
      status: 'ACTIVE',
      notes: 'Main warehouse for Karachi and Sindh region',
      capacity: 5000,
    },
  });

  const warehouseLahore = await prisma.warehouse.upsert({
    where: { name: 'Lahore Warehouse' },
    update: {},
    create: {
      name: 'Lahore Warehouse',
      city: 'Lahore',
      address: 'Block C, Sundar Industrial Estate, Lahore',
      contactPerson: 'Asad Mehmood',
      phone: '+92 42 3567 8901',
      status: 'ACTIVE',
      notes: 'Main warehouse for Lahore and Punjab region',
      capacity: 4000,
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
    { sku: 'CAB-UTP-CAT6-305',  name: 'UTP Cable Cat6 (305m Box)',              categoryId: categoryMap['Cables & Wiring'],        unitType: 'BOX',   quantity: 45,  minThreshold: 10, costPrice: 85,   sellingPrice: 120,  warehouseId: warehouseKarachi.id },
    { sku: 'CAB-UTP-CAT6A-305', name: 'UTP Cable Cat6A (305m Box)',             categoryId: categoryMap['Cables & Wiring'],        unitType: 'BOX',   quantity: 20,  minThreshold: 5,  costPrice: 140,  sellingPrice: 195,  warehouseId: warehouseKarachi.id },
    { sku: 'CAB-FIB-SM-500',    name: 'Fiber Cable Single-Mode OS2 (500m)',     categoryId: categoryMap['Fiber Optics'],           unitType: 'ROLL',  quantity: 8,   minThreshold: 3,  costPrice: 320,  sellingPrice: 450,  warehouseId: warehouseKarachi.id },
    { sku: 'CAB-FIB-MM-300',    name: 'Fiber Cable Multi-Mode OM3 (300m)',      categoryId: categoryMap['Fiber Optics'],           unitType: 'ROLL',  quantity: 2,   minThreshold: 3,  costPrice: 280,  sellingPrice: 390,  warehouseId: warehouseKarachi.id },
    { sku: 'NET-SW-24P-GIG',    name: 'Managed Switch 24-Port Gigabit',         categoryId: categoryMap['Network Equipment'],      unitType: 'PIECE', quantity: 12,  minThreshold: 2,  costPrice: 850,  sellingPrice: 1200, warehouseId: warehouseKarachi.id },
    { sku: 'NET-SW-48P-GIG',    name: 'Managed Switch 48-Port Gigabit',         categoryId: categoryMap['Network Equipment'],      unitType: 'PIECE', quantity: 5,   minThreshold: 2,  costPrice: 1400, sellingPrice: 1950, warehouseId: warehouseKarachi.id },
    { sku: 'NET-PATCH-PAN-24',  name: 'Patch Panel 24-Port Cat6',               categoryId: categoryMap['Network Equipment'],      unitType: 'PIECE', quantity: 18,  minThreshold: 5,  costPrice: 95,   sellingPrice: 140,  warehouseId: warehouseLahore.id },
    { sku: 'CON-PVC-20MM-3M',   name: 'PVC Conduit 20mm (3m)',                  categoryId: categoryMap['Conduits & Accessories'], unitType: 'PIECE', quantity: 200, minThreshold: 50, costPrice: 3.5,  sellingPrice: 6,    warehouseId: warehouseLahore.id },
    { sku: 'CON-TRAY-100-2M',   name: 'Cable Tray 100mm (2m)',                  categoryId: categoryMap['Conduits & Accessories'], unitType: 'PIECE', quantity: 1,   minThreshold: 20, costPrice: 22,   sellingPrice: 38,   warehouseId: warehouseLahore.id },
    { sku: 'TOOL-CRIMP-RJ45',   name: 'RJ45 Crimping Tool',                     categoryId: categoryMap['Tools & Equipment'],      unitType: 'PIECE', quantity: 8,   minThreshold: 3,  costPrice: 45,   sellingPrice: 75,   warehouseId: warehouseLahore.id },
    { sku: 'TOOL-OTDR-SM',      name: 'OTDR Tester Single-Mode',                categoryId: categoryMap['Tools & Equipment'],      unitType: 'PIECE', quantity: 2,   minThreshold: 1,  costPrice: 2800, sellingPrice: 3800, warehouseId: warehouseLahore.id },
    { sku: 'ELE-BREAKER-20A',   name: 'Circuit Breaker 20A',                    categoryId: categoryMap['Electrical Components'],  unitType: 'PIECE', quantity: 35,  minThreshold: 10, costPrice: 18,   sellingPrice: 32,   warehouseId: warehouseLahore.id },
    { sku: 'SAFE-HELMET-HARD',  name: 'Safety Hard Hat',                        categoryId: categoryMap['Safety & PPE'],           unitType: 'PIECE', quantity: 15,  minThreshold: 5,  costPrice: 25,   sellingPrice: 45,   warehouseId: warehouseLahore.id },
    { sku: 'SAFE-GLOVES-L',     name: 'Safety Gloves (Large)',                  categoryId: categoryMap['Safety & PPE'],           unitType: 'SET',   quantity: 40,  minThreshold: 10, costPrice: 12,   sellingPrice: 22,   warehouseId: warehouseLahore.id },
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
            warehouseId: p.warehouseId || null,
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
      warehouseId: warehouseKarachi.id,
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
      warehouseId: warehouseLahore.id,
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
      warehouseId: warehouseKarachi.id,
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
      warehouseId: warehouseLahore.id,
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
      warehouseId: warehouseLahore.id,
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
        data: { ...txBody, clientId: client.id, warehouseId: clientBody.warehouseId, date: txDate, createdBy: admin.id },
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

  // ── Extra users ───────────────────────────────────────────────────────────────
  const salesRole = await prisma.role.findFirst({ where: { name: 'Sales Manager' } });
  const techRole  = await prisma.role.findFirst({ where: { name: 'Technician' } });

  const salesHash = await bcrypt.hash('Sales@12345', 12);
  const techHash  = await bcrypt.hash('Tech@12345', 12);

  const salesUser = await prisma.user.upsert({
    where: { email: 'sales@inventoria.com' },
    update: {},
    create: { fullName: 'Ali Hassan', email: 'sales@inventoria.com', passwordHash: salesHash, branchId: branch.id, roleId: salesRole?.id || adminRole.id, status: 'ACTIVE' },
  });

  const techUser = await prisma.user.upsert({
    where: { email: 'tech@inventoria.com' },
    update: {},
    create: { fullName: 'Usman Khan', email: 'tech@inventoria.com', passwordHash: techHash, branchId: branch.id, roleId: techRole?.id || adminRole.id, status: 'ACTIVE' },
  });

  // ── Shipment workflow demo users ──────────────────────────────────────────
  console.log('Seeding shipment workflow users...');
  await prisma.user.upsert({
    where: { email: 'boss@inventoria.com' },
    update: { roleId: bossRole.id },
    create: { fullName: 'Boss (Approver)', email: 'boss@inventoria.com', passwordHash: await bcrypt.hash('Boss@12345', 12), branchId: branch.id, roleId: bossRole.id, status: 'ACTIVE' },
  });
  await prisma.user.upsert({
    where: { email: 'manager@inventoria.com' },
    update: { roleId: inventoryManagerRole.id },
    create: { fullName: 'Imran (Inventory Manager)', email: 'manager@inventoria.com', passwordHash: await bcrypt.hash('Manager@12345', 12), branchId: branch.id, roleId: inventoryManagerRole.id, status: 'ACTIVE' },
  });
  await prisma.user.upsert({
    where: { email: 'saboor@inventoria.com' },
    update: { roleId: warehouseStaffRole.id, warehouseIds: [warehouseLahore.id] },
    create: { fullName: 'Saboor (Lahore)', email: 'saboor@inventoria.com', passwordHash: await bcrypt.hash('Saboor@12345', 12), branchId: branch.id, roleId: warehouseStaffRole.id, status: 'ACTIVE', warehouseIds: [warehouseLahore.id] },
  });

  // ── Warehouse-restricted inventory users (strict per-warehouse access) ──────
  const invManagerRoleId = inventoryManagerRole.id;
  await prisma.user.upsert({
    where: { email: 'karachi@inventoria.com' },
    update: { roleId: invManagerRoleId, warehouseIds: [warehouseKarachi.id] },
    create: { fullName: 'Karachi Inventory', email: 'karachi@inventoria.com', passwordHash: await bcrypt.hash('Karachi@12345', 12), branchId: branch.id, roleId: invManagerRoleId, status: 'ACTIVE', warehouseIds: [warehouseKarachi.id] },
  });
  await prisma.user.upsert({
    where: { email: 'lahore@inventoria.com' },
    update: { roleId: invManagerRoleId, warehouseIds: [warehouseLahore.id] },
    create: { fullName: 'Lahore Inventory', email: 'lahore@inventoria.com', passwordHash: await bcrypt.hash('Lahore@12345', 12), branchId: branch.id, roleId: invManagerRoleId, status: 'ACTIVE', warehouseIds: [warehouseLahore.id] },
  });

  // ── Quotations ─────────────────────────────────────────────────────────────
  console.log('Seeding quotations...');
  const client1 = await prisma.client.findFirst({ where: { companyName: 'Gulf Telecom Solutions' } });
  const client2 = await prisma.client.findFirst({ where: { companyName: 'Al-Barakah Contracting LLC' } });
  const client3 = await prisma.client.findFirst({ where: { companyName: 'Emirates Networks LLC' } });

  const prodSwitch = await prisma.product.findFirst({ where: { sku: 'NET-SW-24P-GIG' } });
  const prodPatch  = await prisma.product.findFirst({ where: { sku: 'NET-PATCH-PAN-24' } });
  const prodCable  = await prisma.product.findFirst({ where: { sku: 'CAB-UTP-CAT6-305' } });
  const prodFiber  = await prisma.product.findFirst({ where: { sku: 'CAB-FIB-SM-500' } });

  const year = new Date().getFullYear();

  if (client1 && prodSwitch && !await prisma.quotation.findFirst({ where: { quotationNumber: `QUO-${year}-0001` } })) {
    await prisma.quotation.create({
      data: {
        quotationNumber: `QUO-${year}-0001`,
        clientId: client1.id,
        createdBy: salesUser.id,
        status: 'APPROVED',
        warehouseId: warehouseKarachi.id,
        validUntil: new Date(Date.now() + 30 * 86400000),
        notes: 'Network infrastructure upgrade for main office',
        discountType: 'PERCENTAGE', discountValue: 5, discountAmount: 600,
        taxRate: 0, taxAmount: 0,
        subtotal: 12000, totalAmount: 11400,
        items: {
          create: [
            { productId: prodSwitch.id, description: 'Managed Switch 24-Port Gigabit', quantity: 8, unitPrice: 1200, discount: 0, total: 9600 },
            { productId: prodPatch.id,  description: 'Patch Panel 24-Port Cat6',       quantity: 16, unitPrice: 140, discount: 0, total: 2240 },
          ],
        },
      },
    });
  }

  if (client2 && prodCable && !await prisma.quotation.findFirst({ where: { quotationNumber: `QUO-${year}-0002` } })) {
    await prisma.quotation.create({
      data: {
        quotationNumber: `QUO-${year}-0002`,
        clientId: client2.id,
        createdBy: salesUser.id,
        status: 'SENT',
        warehouseId: warehouseLahore.id,
        validUntil: new Date(Date.now() + 15 * 86400000),
        notes: 'Structured cabling for new building',
        discountType: 'FIXED', discountValue: 0, discountAmount: 0,
        taxRate: 0, taxAmount: 0,
        subtotal: 7200, totalAmount: 7200,
        items: {
          create: [
            { productId: prodCable.id, description: 'UTP Cable Cat6 (305m Box)', quantity: 40, unitPrice: 120, discount: 0, total: 4800 },
            { productId: prodPatch.id, description: 'Patch Panel 24-Port Cat6',  quantity: 17, unitPrice: 140, discount: 0, total: 2380 },
          ],
        },
      },
    });
  }

  if (client3 && prodFiber && !await prisma.quotation.findFirst({ where: { quotationNumber: `QUO-${year}-0003` } })) {
    await prisma.quotation.create({
      data: {
        quotationNumber: `QUO-${year}-0003`,
        clientId: client3.id,
        createdBy: salesUser.id,
        status: 'DRAFT',
        warehouseId: warehouseKarachi.id,
        validUntil: new Date(Date.now() + 20 * 86400000),
        notes: 'Fiber backbone installation',
        discountType: 'PERCENTAGE', discountValue: 0, discountAmount: 0,
        taxRate: 0, taxAmount: 0,
        subtotal: 3600, totalAmount: 3600,
        items: {
          create: [
            { productId: prodFiber.id, description: 'Fiber Cable Single-Mode OS2 (500m)', quantity: 8, unitPrice: 450, discount: 0, total: 3600 },
          ],
        },
      },
    });
  }

  // ── Purchase Orders ─────────────────────────────────────────────────────────
  console.log('Seeding purchase orders...');
  const quot1 = await prisma.quotation.findFirst({ where: { quotationNumber: `QUO-${year}-0001` } });
  const quot2 = await prisma.quotation.findFirst({ where: { quotationNumber: `QUO-${year}-0002` } });

  if (client1 && !await prisma.purchaseOrder.findFirst({ where: { poNumber: `PO-${year}-0001` } })) {
    await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-${year}-0001`,
        clientId: client1.id,
        quotationId: quot1?.id || null,
        createdBy: salesUser.id,
        status: 'APPROVED',
        warehouseId: warehouseKarachi.id,
        notes: 'Approved PO for network upgrade',
        taxRate: 0, taxAmount: 0,
        subtotal: 11400, totalAmount: 11400,
        poDate: new Date(Date.now() - 10 * 86400000),
        expectedDelivery: new Date(Date.now() + 20 * 86400000),
        items: {
          create: [
            { productId: prodSwitch?.id || null, description: 'Managed Switch 24-Port Gigabit', quantity: 8,  unitPrice: 1200, total: 9600 },
            { productId: prodPatch?.id  || null, description: 'Patch Panel 24-Port Cat6',       quantity: 16, unitPrice: 140,  total: 2240 },
          ],
        },
      },
    });
  }

  if (client2 && !await prisma.purchaseOrder.findFirst({ where: { poNumber: `PO-${year}-0002` } })) {
    await prisma.purchaseOrder.create({
      data: {
        poNumber: `PO-${year}-0002`,
        clientId: client2.id,
        quotationId: quot2?.id || null,
        createdBy: salesUser.id,
        status: 'PENDING',
        warehouseId: warehouseLahore.id,
        notes: 'Awaiting approval',
        taxRate: 0, taxAmount: 0,
        subtotal: 7200, totalAmount: 7200,
        poDate: new Date(),
        items: {
          create: [
            { productId: prodCable?.id || null, description: 'UTP Cable Cat6 (305m Box)', quantity: 40, unitPrice: 120, total: 4800 },
            { productId: prodPatch?.id || null, description: 'Patch Panel 24-Port Cat6',  quantity: 17, unitPrice: 140, total: 2380 },
          ],
        },
      },
    });
  }

  // ── Sales Orders ────────────────────────────────────────────────────────────
  console.log('Seeding sales orders...');
  const po1 = await prisma.purchaseOrder.findFirst({ where: { poNumber: `PO-${year}-0001` } });

  if (client1 && !await prisma.sale.findFirst({ where: { saleNumber: `SALE-${year}-0001` } })) {
    const sale = await prisma.sale.create({
      data: {
        saleNumber: `SALE-${year}-0001`,
        clientId: client1.id,
        quotationId: quot1?.id || null,
        poId: po1?.id || null,
        createdBy: salesUser.id,
        status: 'DELIVERED',
        warehouseId: warehouseKarachi.id,
        notes: 'Network equipment — delivered and installed',
        taxRate: 0, taxAmount: 0, discountAmount: 0,
        subtotal: 11400, totalAmount: 11400,
        saleDate: new Date(Date.now() - 5 * 86400000),
        items: {
          create: [
            { productId: prodSwitch?.id || null, description: 'Managed Switch 24-Port Gigabit', quantity: 8,  unitPrice: 1200, costPrice: 850, discount: 0, total: 9600 },
            { productId: prodPatch?.id  || null, description: 'Patch Panel 24-Port Cat6',       quantity: 16, unitPrice: 140,  costPrice: 95,  discount: 0, total: 2240 },
          ],
        },
      },
    });

    // Create client invoice for this sale
    const invoice = await prisma.clientTransaction.create({
      data: {
        clientId: client1.id, type: 'INVOICE', amount: 11400,
        warehouseId: warehouseKarachi.id,
        description: `Invoice for Sale ${sale.saleNumber}`,
        reference: sale.saleNumber, date: new Date(Date.now() - 5 * 86400000),
        createdBy: salesUser.id,
      },
    });
    await prisma.sale.update({ where: { id: sale.id }, data: { invoiceId: invoice.id } });
  }

  if (client3 && !await prisma.sale.findFirst({ where: { saleNumber: `SALE-${year}-0002` } })) {
    await prisma.sale.create({
      data: {
        saleNumber: `SALE-${year}-0002`,
        clientId: client3.id,
        createdBy: salesUser.id,
        status: 'CONFIRMED',
        warehouseId: warehouseKarachi.id,
        notes: 'Fiber cables — confirmed, awaiting delivery',
        taxRate: 0, taxAmount: 0, discountAmount: 0,
        subtotal: 3600, totalAmount: 3600,
        saleDate: new Date(Date.now() - 2 * 86400000),
        items: {
          create: [
            { productId: prodFiber?.id || null, description: 'Fiber Cable Single-Mode OS2 (500m)', quantity: 8, unitPrice: 450, costPrice: 320, discount: 0, total: 3600 },
          ],
        },
      },
    });
  }

  // ── Projects ────────────────────────────────────────────────────────────────
  console.log('Seeding projects...');
  const sale1 = await prisma.sale.findFirst({ where: { saleNumber: `SALE-${year}-0001` } });

  if (!await prisma.project.findFirst({ where: { projectNumber: `PROJ-${year}-0001` } })) {
    const proj = await prisma.project.create({
      data: {
        projectNumber: `PROJ-${year}-0001`,
        title: 'Gulf Telecom – Network Infrastructure Upgrade',
        clientId: client1.id,
        saleId: sale1?.id || null,
        managerId: admin.id,
        location: 'Business Bay Tower 3',
        address: 'Business Bay, Tower 3, Floor 12',
        city: 'Dubai',
        status: 'ACTIVE',
        warehouseId: warehouseKarachi.id,
        startDate: new Date(Date.now() - 7 * 86400000),
        estimatedEndDate: new Date(Date.now() + 30 * 86400000),
        notes: 'Full network infrastructure upgrade including switches, patch panels and structured cabling.',
        createdBy: admin.id,
      },
    });

    await prisma.projectAssignment.create({
      data: { projectId: proj.id, userId: techUser.id, role: 'TECHNICIAN', assignedBy: admin.id },
    });

    await prisma.siteVisit.create({
      data: {
        projectId: proj.id, visitedBy: techUser.id,
        visitDate: new Date(Date.now() - 5 * 86400000),
        purpose: 'Initial site survey and measurement',
        observations: 'Completed full site survey. 8 switch locations identified, cable routing planned.',
        notes: 'All areas accessible. No structural changes needed.',
      },
    });

    await prisma.workLog.create({
      data: {
        projectId: proj.id, userId: techUser.id,
        logDate: new Date(Date.now() - 3 * 86400000),
        hoursWorked: 8,
        notes: 'Installed patch panels and cable trays in all server rooms.',
      },
    });
  }

  if (client2 && !await prisma.project.findFirst({ where: { projectNumber: `PROJ-${year}-0002` } })) {
    const proj2 = await prisma.project.create({
      data: {
        projectNumber: `PROJ-${year}-0002`,
        title: 'Al-Barakah – CCTV & Access Control',
        clientId: client2.id,
        managerId: admin.id,
        location: 'Industrial Area Block 7',
        city: 'Abu Dhabi',
        status: 'PLANNING',
        warehouseId: warehouseLahore.id,
        startDate: new Date(Date.now() + 7 * 86400000),
        estimatedEndDate: new Date(Date.now() + 60 * 86400000),
        notes: 'CCTV cameras, access control system and security cabling.',
        createdBy: admin.id,
      },
    });

    await prisma.projectAssignment.create({
      data: { projectId: proj2.id, userId: techUser.id, role: 'TECHNICIAN', assignedBy: admin.id },
    });
  }

  // ── Approvals ───────────────────────────────────────────────────────────────
  console.log('Seeding approvals...');
  if (!await prisma.approvalRequest.findFirst({ where: { title: 'Approve Quotation QUO-0001' } })) {
    await prisma.approvalRequest.create({
      data: {
        type: 'QUOTATION',
        title: 'Approve Quotation QUO-0001',
        description: 'Gulf Telecom network upgrade quotation for PKR 11,400. Please review and approve.',
        warehouseId: warehouseKarachi.id,
        requestedBy: salesUser.id,
        assignedTo: admin.id,
        priority: 'HIGH',
        status: 'APPROVED',
        decidedBy: admin.id,
        decidedAt: new Date(Date.now() - 8 * 86400000),
        decisionNote: 'Approved. Proceed with purchase order.',
      },
    });
  }

  if (!await prisma.approvalRequest.findFirst({ where: { title: 'Stock Adjustment – Cable Tray' } })) {
    await prisma.approvalRequest.create({
      data: {
        type: 'INVENTORY_ADJUSTMENT',
        title: 'Stock Adjustment – Cable Tray',
        description: 'Requesting emergency stock adjustment for Cable Tray 100mm. Current stock is critically low (1 unit, threshold 20).',
        warehouseId: warehouseLahore.id,
        requestedBy: techUser.id,
        assignedTo: admin.id,
        priority: 'HIGH',
        status: 'PENDING',
      },
    });
  }

  if (!await prisma.approvalRequest.findFirst({ where: { title: 'Approve Purchase Order PO-0002' } })) {
    await prisma.approvalRequest.create({
      data: {
        type: 'PURCHASE_ORDER',
        title: 'Approve Purchase Order PO-0002',
        description: 'Al-Barakah structured cabling PO for PKR 7,200. Awaiting management sign-off.',
        warehouseId: warehouseLahore.id,
        requestedBy: salesUser.id,
        assignedTo: admin.id,
        priority: 'NORMAL',
        status: 'PENDING',
      },
    });
  }

  // ── Documents ───────────────────────────────────────────────────────────────
  console.log('Seeding documents...');
  const proj1 = await prisma.project.findFirst({ where: { projectNumber: `PROJ-${year}-0001` } });

  if (!await prisma.document.findFirst({ where: { title: 'Network Diagram – Gulf Telecom' } })) {
    await prisma.document.create({
      data: {
        title: 'Network Diagram – Gulf Telecom',
        description: 'Full network topology diagram for the Gulf Telecom Business Bay project.',
        category: 'Technical',
        fileUrl: 'https://example.com/docs/network-diagram-gulf-telecom.pdf',
        fileName: 'network-diagram-gulf-telecom.pdf',
        mimeType: 'application/pdf',
        fileSize: 245760,
        warehouseId: warehouseKarachi.id,
        projectId: proj1?.id || null,
        clientId: client1?.id || null,
        uploadedBy: admin.id,
        version: 1,
      },
    });
  }

  if (!await prisma.document.findFirst({ where: { title: 'Quotation QUO-0001 – Signed Copy' } })) {
    await prisma.document.create({
      data: {
        title: 'Quotation QUO-0001 – Signed Copy',
        description: 'Client-signed quotation for Gulf Telecom network upgrade.',
        category: 'Contracts',
        fileUrl: 'https://example.com/docs/quo-0001-signed.pdf',
        fileName: 'quo-0001-signed.pdf',
        mimeType: 'application/pdf',
        fileSize: 128000,
        warehouseId: warehouseKarachi.id,
        clientId: client1?.id || null,
        uploadedBy: salesUser.id,
        version: 1,
      },
    });
  }

  if (!await prisma.document.findFirst({ where: { title: 'Site Survey Report – Gulf Telecom' } })) {
    await prisma.document.create({
      data: {
        title: 'Site Survey Report – Gulf Telecom',
        description: 'Initial site survey report with photos and cable routing plan.',
        category: 'Reports',
        fileUrl: 'https://example.com/docs/site-survey-gulf-telecom.pdf',
        fileName: 'site-survey-gulf-telecom.pdf',
        mimeType: 'application/pdf',
        fileSize: 512000,
        warehouseId: warehouseKarachi.id,
        projectId: proj1?.id || null,
        uploadedBy: techUser.id,
        version: 1,
      },
    });
  }

  // ── Notifications ────────────────────────────────────────────────────────────
  console.log('Seeding notifications...');
  if (!await prisma.notification.findFirst({ where: { title: 'Low Stock Alert: Cable Tray 100mm' } })) {
    await prisma.notification.create({
      data: {
        userId: admin.id, type: 'LOW_STOCK',
        title: 'Low Stock Alert: Cable Tray 100mm',
        message: 'Cable Tray 100mm (2m) is critically low (1 unit). Minimum threshold is 20 units.',
        link: '/inventory/products',
      },
    });
  }

  if (!await prisma.notification.findFirst({ where: { title: 'New Approval Request: Stock Adjustment' } })) {
    await prisma.notification.create({
      data: {
        userId: admin.id, type: 'APPROVAL_REQUIRED',
        title: 'New Approval Request: Stock Adjustment',
        message: 'Usman Khan has submitted a stock adjustment request for Cable Tray.',
        link: '/approvals',
      },
    });
  }

  if (!await prisma.notification.findFirst({ where: { title: 'Sale SALE-0001 Delivered' } })) {
    await prisma.notification.create({
      data: {
        userId: admin.id, type: 'SUCCESS',
        title: 'Sale SALE-0001 Delivered',
        message: 'Sale for Gulf Telecom Solutions has been marked as delivered.',
        link: '/sales/orders',
        isRead: true,
      },
    });
  }

  // ── Shipments (inter-warehouse transfers) ─────────────────────────────────────
  console.log('Seeding shipments...');

  const skuMap = {};
  for (const sku of ['CAB-UTP-CAT6-305', 'NET-SW-24P-GIG', 'NET-PATCH-PAN-24', 'CON-PVC-20MM-3M']) {
    skuMap[sku] = await prisma.product.findFirst({ where: { sku } });
  }

  async function seedShipment({ number, sourceId, destId, status, notes, items, decided, received, consignmentNumber }) {
    if (await prisma.shipment.findFirst({ where: { shipmentNumber: number } })) return;
    const created = await prisma.shipment.create({
      data: {
        shipmentNumber: number,
        consignmentNumber: consignmentNumber || null,
        sourceWarehouseId: sourceId,
        destWarehouseId: destId,
        status,
        notes: notes || null,
        createdBy: salesUser.id,
        approvedBy: decided ? admin.id : null,
        approvedAt: decided ? new Date(Date.now() - 2 * 86400000) : null,
        decisionNote: decided ? 'Approved for transfer.' : null,
        receivedBy: received ? admin.id : null,
        receivedAt: received ? new Date(Date.now() - 1 * 86400000) : null,
        items: {
          create: items
            .filter((it) => it.product)
            .map((it) => ({
              productId: it.product.id,
              sku: it.product.sku,
              description: it.product.name,
              quantity: it.quantity,
            })),
        },
      },
      include: { sourceWarehouse: true, destWarehouse: true, items: true },
    });

    // Pending shipments get a linked Approval Workflow request so the Boss can act
    if (status === 'PENDING_APPROVAL') {
      await prisma.approvalRequest.create({
        data: {
          type: 'SHIPMENT', status: 'PENDING', priority: 'HIGH',
          title: `Shipment ${number}`,
          description: `${created.sourceWarehouse.name} → ${created.destWarehouse.name} · ${created.items.length} item(s)`,
          referenceType: 'Shipment', referenceId: created.id, requestedBy: salesUser.id,
        },
      });
    }
  }

  const year2 = new Date().getFullYear();

  // 1) Newly created at Karachi, waiting for the Boss to approve
  await seedShipment({
    number: `SHP-${year2}-0001`,
    sourceId: warehouseKarachi.id, destId: warehouseLahore.id,
    status: 'PENDING_APPROVAL',
    notes: 'Cat6 cable restock for Lahore site work',
    items: [{ product: skuMap['CAB-UTP-CAT6-305'], quantity: 5 }],
  });

  // 2) Pending boss approval (Karachi → Lahore)
  await seedShipment({
    number: `SHP-${year2}-0002`,
    sourceId: warehouseKarachi.id, destId: warehouseLahore.id,
    status: 'PENDING_APPROVAL',
    notes: 'Two managed switches requested by Lahore branch',
    items: [{ product: skuMap['NET-SW-24P-GIG'], quantity: 2 }],
  });
  // Notify boss for the pending one
  if (!await prisma.notification.findFirst({ where: { title: `Shipment SHP-${year2}-0002 needs approval` } })) {
    await prisma.notification.create({
      data: {
        userId: admin.id, type: 'APPROVAL_REQUIRED',
        title: `Shipment SHP-${year2}-0002 needs approval`,
        message: 'Karachi Warehouse → Lahore Warehouse. Review and approve the transfer.',
        link: '/inventory/shipments',
      },
    });
  }

  // 3) Approved, waiting for Lahore to accept the delivery (incoming to Lahore)
  await seedShipment({
    number: `SHP-${year2}-0003`,
    sourceId: warehouseKarachi.id, destId: warehouseLahore.id,
    status: 'APPROVED', decided: true,
    notes: 'Cat6 cable — approved, awaiting receipt at Lahore',
    items: [{ product: skuMap['CAB-UTP-CAT6-305'], quantity: 3 }],
  });
  if (!await prisma.notification.findFirst({ where: { title: `Shipment SHP-${year2}-0003 approved` } })) {
    await prisma.notification.create({
      data: {
        userId: admin.id, type: 'APPROVAL_DECIDED',
        title: `Shipment SHP-${year2}-0003 approved`,
        message: 'Approved for Lahore Warehouse. Switch to Lahore Warehouse to accept the delivery.',
        link: '/inventory/shipments',
      },
    });
  }

  // 4) Completed transfer (Lahore → Karachi), already received — history
  await seedShipment({
    number: `SHP-${year2}-0004`,
    sourceId: warehouseLahore.id, destId: warehouseKarachi.id,
    status: 'RECEIVED', decided: true, received: true,
    notes: 'PVC conduit transfer completed',
    items: [{ product: skuMap['CON-PVC-20MM-3M'], quantity: 20 }],
  });

  // ── Brands & brand products (real company stock) ──────────────────────────────
  console.log('Seeding brands & products...');

  async function ensureCategory(name) {
    const c = await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
    return c.id;
  }

  const catFireDetection = await ensureCategory('Fire Detection');
  const catFirePanels    = await ensureCategory('Fire Alarm Panels');
  const catFireDevices   = await ensureCategory('Fire Alarm Devices');
  const catFireCable     = await ensureCategory('Fire Alarm Cable');
  const catAccessCards   = await ensureCategory('Access Control & Cards');
  const catLighting      = await ensureCategory('Emergency Lighting');
  const catFireDoors     = await ensureCategory('Fire Doors');

  // Each brand with 1–2 representative products (from the client's real stock sheet)
  const BRANDS = [
    { name: 'INIM', products: [
      { name: 'Smoke Detector', sku: 'ED-100', quantity: 10, categoryId: catFireDetection, unitType: 'PIECE', costPrice: 900,  sellingPrice: 1300 },
      { name: 'Heat Detector',  sku: 'ED-200', quantity: 3,  categoryId: catFireDetection, unitType: 'PIECE', costPrice: 950,  sellingPrice: 1400 },
    ]},
    { name: 'Context Plus', products: [
      { name: '2 Zone Panel',  sku: 'CFP-702',       quantity: 26, categoryId: catFirePanels,    unitType: 'PIECE', costPrice: 6500, sellingPrice: 9000 },
      { name: 'Heat Detector', sku: '58000-450IMCI', quantity: 20, categoryId: catFireDetection, unitType: 'PIECE', costPrice: 700,  sellingPrice: 1050 },
    ]},
    { name: 'Cease Fire Italia Addressable', products: [
      { name: 'Intelligent Photoelectric Smoke Detector', sku: 'CFI-5131', quantity: 424, categoryId: catFireDetection, unitType: 'PIECE', costPrice: 1100, sellingPrice: 1650 },
      { name: 'Heat Detector',                            sku: 'CFI-5132', quantity: 170, categoryId: catFireDetection, unitType: 'PIECE', costPrice: 1000, sellingPrice: 1500 },
    ]},
    { name: 'Cease Fire Italia Conventional', products: [
      { name: 'Smoke Detector',  sku: 'CFI1000', quantity: 837, categoryId: catFireDetection, unitType: 'PIECE', costPrice: 450, sellingPrice: 700 },
      { name: 'Sounder Flasher', sku: 'CFI-6000', quantity: 163, categoryId: catFireDevices,   unitType: 'PIECE', costPrice: 600, sellingPrice: 900 },
    ]},
    { name: 'CFI Lock', products: [
      { name: 'Em Lock',     sku: 'CFI-200', quantity: 96,  categoryId: catAccessCards, unitType: 'PIECE', costPrice: 1200, sellingPrice: 1800 },
      { name: 'Push Button', sku: 'CFI-K6B', quantity: 100, categoryId: catAccessCards, unitType: 'PIECE', costPrice: 250,  sellingPrice: 400 },
    ]},
    { name: 'Lights Stock', products: [
      { name: 'Emergency Light', sku: 'GM6-3H-HO', quantity: 20, categoryId: catLighting, unitType: 'PIECE', costPrice: 800, sellingPrice: 1200 },
      { name: 'Exit Sign',       sku: 'GN-206',    quantity: 32, categoryId: catLighting, unitType: 'PIECE', costPrice: 600, sellingPrice: 950 },
    ]},
    { name: 'Fire Alarm Cable', products: [
      { name: 'UL Listed Cable 1.5mm', sku: 'FPLR-1.5MM', quantity: 1380, categoryId: catFireCable, unitType: 'ROLL', costPrice: 60,  sellingPrice: 95 },
      { name: 'UL Listed Cable 2.5mm', sku: 'FPLR-2.5MM', quantity: 5500, categoryId: catFireCable, unitType: 'ROLL', costPrice: 90,  sellingPrice: 140 },
    ]},
    { name: 'Honeywell', products: [
      { name: '8 Zone Panel', sku: 'CFAS-408', quantity: 3,  categoryId: catFirePanels,  unitType: 'PIECE', costPrice: 8000, sellingPrice: 11500 },
      { name: 'Sounder',      sku: 'S3-S-R',   quantity: 11, categoryId: catFireDevices, unitType: 'PIECE', costPrice: 500,  sellingPrice: 800 },
    ]},
    { name: 'Fire Door', products: [
      { name: 'Fire Door Left',  sku: 'AT-1038-LHR', quantity: 6, categoryId: catFireDoors, unitType: 'PIECE', costPrice: 15000, sellingPrice: 22000 },
      { name: 'Fire Door Right', sku: 'AT-1038-RHR', quantity: 8, categoryId: catFireDoors, unitType: 'PIECE', costPrice: 15000, sellingPrice: 22000 },
    ]},
    { name: 'Horinlih', products: [
      { name: 'Smoke Detector', sku: 'AH0311-2', quantity: 5, categoryId: catFireDetection, unitType: 'PIECE', costPrice: 400, sellingPrice: 650 },
      { name: 'Manual Call Point', sku: 'AH-0217', quantity: 5, categoryId: catFireDevices, unitType: 'PIECE', costPrice: 350, sellingPrice: 550 },
    ]},
    { name: 'Cards', products: [
      { name: 'PVC Card',         sku: 'CFI-PVC',   quantity: 32000, categoryId: catAccessCards, unitType: 'PIECE', costPrice: 8,  sellingPrice: 15 },
      { name: 'RFID Card (Serial)', sku: 'CFI-ID125', quantity: 39000, categoryId: catAccessCards, unitType: 'PIECE', costPrice: 12, sellingPrice: 22 },
    ]},
    { name: 'Hochiki', products: [
      { name: '2 Zone Panel', sku: 'HFP-CP-2KS', quantity: 1, categoryId: catFirePanels, unitType: 'PIECE', costPrice: 9000, sellingPrice: 13000 },
    ]},
    { name: 'Maple Armour', products: [
      { name: 'Smoke Detector', sku: 'FW-511', quantity: 2, categoryId: catFireDetection, unitType: 'PIECE', costPrice: 500, sellingPrice: 800 },
      { name: 'Heat Detector',  sku: 'FW-521', quantity: 2, categoryId: catFireDetection, unitType: 'PIECE', costPrice: 520, sellingPrice: 820 },
    ]},
  ];

  const brandSku = {}; // sku -> productId (for sales below)
  for (const b of BRANDS) {
    const brand = await prisma.brand.upsert({ where: { name: b.name }, update: {}, create: { name: b.name } });
    for (const p of b.products) {
      let product = await prisma.product.findUnique({ where: { sku: p.sku } });
      if (!product) {
        product = await prisma.product.create({
          data: {
            sku: p.sku, name: p.name, categoryId: p.categoryId, brandId: brand.id,
            unitType: p.unitType, quantity: p.quantity, minThreshold: 5,
            costPrice: p.costPrice, sellingPrice: p.sellingPrice,
            status: 'ACTIVE', warehouseId: warehouseKarachi.id,
          },
        });
        if (p.quantity > 0) {
          await prisma.inventoryTransaction.create({
            data: { productId: product.id, type: 'STOCK_IN', quantity: p.quantity, balanceAfter: p.quantity, warehouseId: warehouseKarachi.id, notes: 'Initial stock — seed data', createdBy: admin.id },
          });
        }
      } else if (!product.brandId) {
        await prisma.product.update({ where: { id: product.id }, data: { brandId: brand.id } });
      }
      brandSku[p.sku] = product.id;
    }
  }

  // Sample sales so the product "given to client" distribution has real data
  async function seedBrandSale({ number, client, items }) {
    if (!client) return;
    if (await prisma.sale.findFirst({ where: { saleNumber: number } })) return;
    const lineData = items
      .filter((it) => brandSku[it.sku])
      .map((it) => ({ productId: brandSku[it.sku], description: it.name, quantity: it.qty, unitPrice: it.price, costPrice: 0, discount: 0, total: it.qty * it.price }));
    const subtotal = lineData.reduce((a, l) => a + l.total, 0);
    await prisma.sale.create({
      data: {
        saleNumber: number, clientId: client.id, createdBy: salesUser.id,
        status: 'DELIVERED', warehouseId: warehouseKarachi.id,
        subtotal, totalAmount: subtotal, taxRate: 0, taxAmount: 0, discountAmount: 0,
        saleDate: new Date(Date.now() - 6 * 86400000),
        items: { create: lineData },
      },
    });
  }

  await seedBrandSale({
    number: `SALE-${year}-1001`, client: client1,
    items: [
      { sku: 'ED-100',  name: 'INIM Smoke Detector', qty: 4,  price: 1300 },
      { sku: 'CFI1000', name: 'Cease Fire Smoke Detector', qty: 10, price: 700 },
    ],
  });
  await seedBrandSale({
    number: `SALE-${year}-1002`, client: client3,
    items: [
      { sku: 'ED-100',  name: 'INIM Smoke Detector', qty: 2, price: 1300 },
      { sku: 'CFI-5131', name: 'Cease Fire Photoelectric Smoke Detector', qty: 5, price: 1650 },
    ],
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
