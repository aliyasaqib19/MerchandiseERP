import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Auth
import LoginPage from './pages/auth/LoginPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

// Core
import DashboardPage from './pages/DashboardPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

// Admin
import UsersPage from './pages/users/UsersPage';
import RolesPage from './pages/roles/RolesPage';

// Inventory
import InventoryDashboard from './pages/inventory/InventoryDashboard';
import ProductListPage from './pages/inventory/ProductListPage';
import ProductDetailPage from './pages/inventory/ProductDetailPage';
import InventoryHistoryPage from './pages/inventory/InventoryHistoryPage';

// Warehouses
import WarehousesPage from './pages/warehouses/WarehousesPage';
import WarehouseDetailPage from './pages/warehouses/WarehouseDetailPage';

// CRM
import ClientsPage from './pages/clients/ClientsPage';
import ClientDetailPage from './pages/clients/ClientDetailPage';
import ClientLedgerPage from './pages/clients/ClientLedgerPage';
import ContactsPage from './pages/clients/ContactsPage';

// Sales
import SalesDashboard from './pages/sales/SalesDashboard';
import QuotationsPage from './pages/sales/QuotationsPage';
import PurchaseOrdersPage from './pages/sales/PurchaseOrdersPage';
import SalesOrdersPage from './pages/sales/SalesOrdersPage';

// Projects
import ProjectsPage from './pages/projects/ProjectsPage';
import ProjectDetailPage from './pages/projects/ProjectDetailPage';
import SiteVisitPage from './pages/projects/SiteVisitPage';
import WorkLogPage from './pages/projects/WorkLogPage';
import ServiceReportPage from './pages/projects/ServiceReportPage';

// Approvals
import ApprovalsPage from './pages/approvals/ApprovalsPage';

// Documents
import DocumentsPage from './pages/documents/DocumentsPage';

// Notifications
import NotificationsPage from './pages/notifications/NotificationsPage';

// Audit
import AuditPage from './pages/audit/AuditPage';

// Analytics
import AnalyticsPage from './pages/analytics/AnalyticsPage';

// Profile & Settings
import ProfilePage from './pages/profile/ProfilePage';
import SettingsPage from './pages/settings/SettingsPage';

// Finance
import FinanceDashboard from './pages/finance/FinanceDashboard';
import InvoiceListPage from './pages/finance/InvoiceListPage';
import PaymentsPage from './pages/finance/PaymentsPage';
import OutstandingPage from './pages/finance/OutstandingPage';
import AgedReceivablesPage from './pages/finance/AgedReceivablesPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function Guarded({ permission, children }) {
  return <ProtectedRoute permission={permission}>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Protected shell */}
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            {/* ── Warehouses ── */}
            <Route path="/warehouses"     element={<Guarded permission="INVENTORY_VIEW"><WarehousesPage /></Guarded>} />
            <Route path="/warehouses/:id" element={<Guarded permission="INVENTORY_VIEW"><WarehouseDetailPage /></Guarded>} />

            {/* ── Inventory ── */}
            <Route path="/inventory" element={<Guarded permission="INVENTORY_VIEW"><InventoryDashboard /></Guarded>} />
            <Route path="/inventory/products" element={<Guarded permission="INVENTORY_VIEW"><ProductListPage /></Guarded>} />
            <Route path="/inventory/products/:id" element={<Guarded permission="INVENTORY_VIEW"><ProductDetailPage /></Guarded>} />
            <Route path="/inventory/movements" element={<Guarded permission="INVENTORY_VIEW"><InventoryHistoryPage /></Guarded>} />

            {/* ── CRM ── */}
            <Route path="/clients" element={<Guarded permission="CLIENTS_VIEW"><ClientsPage /></Guarded>} />
            <Route path="/clients/contacts" element={<Guarded permission="CLIENTS_VIEW"><ContactsPage /></Guarded>} />
            <Route path="/clients/:id" element={<Guarded permission="CLIENTS_VIEW"><ClientDetailPage /></Guarded>} />
            <Route path="/clients/:id/ledger" element={<Guarded permission="CLIENTS_VIEW"><ClientLedgerPage /></Guarded>} />

            {/* ── Sales ── */}
            <Route path="/sales"                  element={<Guarded permission="SALES_VIEW"><SalesDashboard /></Guarded>} />
            <Route path="/sales/quotations"       element={<Guarded permission="SALES_VIEW"><QuotationsPage /></Guarded>} />
            <Route path="/sales/purchase-orders"  element={<Guarded permission="SALES_VIEW"><PurchaseOrdersPage /></Guarded>} />
            <Route path="/sales/orders"           element={<Guarded permission="SALES_VIEW"><SalesOrdersPage /></Guarded>} />

            {/* ── Projects ── */}
            <Route path="/projects"                                         element={<Guarded permission="PROJECTS_VIEW"><ProjectsPage /></Guarded>} />
            <Route path="/projects/:id"                                     element={<Guarded permission="PROJECTS_VIEW"><ProjectDetailPage /></Guarded>} />
            <Route path="/projects/:projectId/visits/new"                   element={<Guarded permission="PROJECTS_UPDATE"><SiteVisitPage /></Guarded>} />
            <Route path="/projects/:projectId/visits/:visitId"              element={<Guarded permission="PROJECTS_VIEW"><SiteVisitPage /></Guarded>} />
            <Route path="/projects/:projectId/work-logs/new"                element={<Guarded permission="PROJECTS_UPDATE"><WorkLogPage /></Guarded>} />
            <Route path="/projects/:projectId/work-logs/:logId"             element={<Guarded permission="PROJECTS_VIEW"><WorkLogPage /></Guarded>} />
            <Route path="/projects/:projectId/reports/:reportId"            element={<Guarded permission="PROJECTS_VIEW"><ServiceReportPage /></Guarded>} />

            {/* ── Finance ── */}
            <Route path="/finance"                    element={<Guarded permission="FINANCE_VIEW"><FinanceDashboard /></Guarded>} />
            <Route path="/finance/invoices"           element={<Guarded permission="FINANCE_VIEW"><InvoiceListPage /></Guarded>} />
            <Route path="/finance/payments"           element={<Guarded permission="FINANCE_VIEW"><PaymentsPage /></Guarded>} />
            <Route path="/finance/outstanding"        element={<Guarded permission="FINANCE_VIEW"><OutstandingPage /></Guarded>} />
            <Route path="/finance/aged-receivables"   element={<Guarded permission="FINANCE_VIEW"><AgedReceivablesPage /></Guarded>} />

            {/* ── Approvals ── */}
            <Route path="/approvals" element={<Guarded permission="APPROVALS_VIEW"><ApprovalsPage /></Guarded>} />

            {/* ── Documents ── */}
            <Route path="/documents" element={<Guarded permission="DOCUMENTS_VIEW"><DocumentsPage /></Guarded>} />

            {/* ── Notifications ── */}
            <Route path="/notifications" element={<NotificationsPage />} />

            {/* ── Audit ── */}
            <Route path="/audit" element={<Guarded permission="AUDIT_VIEW"><AuditPage /></Guarded>} />

            {/* ── Analytics ── */}
            <Route path="/analytics" element={<Guarded permission="REPORTS_VIEW"><AnalyticsPage /></Guarded>} />

            {/* ── Profile & Settings ── */}
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<Guarded permission="SETTINGS_VIEW"><SettingsPage /></Guarded>} />

            {/* ── Admin ── */}
            <Route path="/users" element={<Guarded permission="USERS_VIEW"><UsersPage /></Guarded>} />
            <Route path="/roles" element={<Guarded permission="ROLES_VIEW"><RolesPage /></Guarded>} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
