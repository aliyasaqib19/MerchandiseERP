require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const roleRoutes = require('./routes/role.routes');
const permissionRoutes = require('./routes/permission.routes');
const inventoryRoutes      = require('./routes/inventory.routes');
const clientRoutes         = require('./routes/client.routes');
const quotationRoutes      = require('./routes/quotation.routes');
const purchaseOrderRoutes  = require('./routes/purchaseOrder.routes');
const saleRoutes           = require('./routes/sale.routes');
const financeRoutes        = require('./routes/finance.routes');
const projectRoutes        = require('./routes/project.routes');
const siteVisitRoutes      = require('./routes/siteVisit.routes');
const workLogRoutes        = require('./routes/workLog.routes');
const serviceReportRoutes  = require('./routes/serviceReport.routes');
const approvalRoutes       = require('./routes/approval.routes');
const documentRoutes       = require('./routes/document.routes');
const notificationRoutes   = require('./routes/notification.routes');
const auditRoutes          = require('./routes/audit.routes');
const reportRoutes         = require('./routes/report.routes');

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(u => u.trim())
    : ['http://localhost:5173', 'http://localhost:5000'],
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/inventory',       inventoryRoutes);
app.use('/api/clients',         clientRoutes);
app.use('/api/quotations',      quotationRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/sales',           saleRoutes);
app.use('/api/finance',         financeRoutes);
app.use('/api/projects',        projectRoutes);
// Nested resources (mergeParams handled inside routers)
app.use('/api/projects/:projectId/visits',     siteVisitRoutes);
app.use('/api/projects/:projectId/work-logs',  workLogRoutes);
app.use('/api/projects/:projectId/reports',    serviceReportRoutes);
// Flat access by id
app.use('/api/visits',          siteVisitRoutes);
app.use('/api/work-logs',       workLogRoutes);
app.use('/api/reports',         serviceReportRoutes);

app.use('/api/approvals',      approvalRoutes);
app.use('/api/documents',      documentRoutes);
app.use('/api/notifications',  notificationRoutes);
app.use('/api/audit',          auditRoutes);
app.use('/api/analytics',      reportRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Serve built React client in production (Electron / packaged mode)
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'public');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }
}

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
