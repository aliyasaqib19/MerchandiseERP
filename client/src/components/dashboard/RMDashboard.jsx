import { useQuery } from '@tanstack/react-query';
import {
  Package, FolderKanban, DollarSign, Users,
  UserPlus, FilePlus, FolderPlus, FileText,
} from 'lucide-react';
import { StatsCard } from './StatsCard';
import { ActivityFeed } from './ActivityFeed';
import { QuickActions } from './QuickActions';
import { useWarehouseStore } from '../../store/warehouseStore';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';

const QUICK_ACTIONS = [
  { label: 'New Sale',      icon: FilePlus,   to: '/sales/orders', primary: true },
  { label: 'New Project',   icon: FolderPlus, to: '/projects',     primary: false },
  { label: 'Inventory',     icon: Package,    to: '/inventory',    primary: false },
  { label: 'New Client',    icon: UserPlus,   to: '/clients',      primary: false },
];

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function money(n) {
  return `Rs. ${Number(n || 0).toLocaleString()}`;
}

// A general-purpose dashboard for any role that isn't specifically
// Administrator / Sales / Technician — e.g. Operational Manager, Warehouse
// Incharge, or any custom role. Only queries the stats endpoints the user
// actually has permission for, so it never 403s, and shows real figures
// instead of placeholder numbers.
export function RMDashboard() {
  const activeWarehouse = useWarehouseStore((s) => s.activeWarehouse);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const whId = activeWarehouse?.id;

  const canInventory = hasPermission('INVENTORY_VIEW');
  const canProjects  = hasPermission('PROJECTS_VIEW');
  const canSales     = hasPermission('SALES_VIEW');
  const canFinance   = hasPermission('FINANCE_VIEW');

  const { data: inventory } = useQuery({
    queryKey: ['dash-inventory', whId],
    queryFn: () => api.get('/inventory/stats').then((r) => r.data),
    enabled: canInventory,
  });
  const { data: projects } = useQuery({
    queryKey: ['dash-projects', whId],
    queryFn: () => api.get('/projects/stats').then((r) => r.data),
    enabled: canProjects,
  });
  const { data: sales } = useQuery({
    queryKey: ['dash-sales', whId],
    queryFn: () => api.get('/sales/stats').then((r) => r.data),
    enabled: canSales,
  });
  const { data: finance } = useQuery({
    queryKey: ['dash-finance', whId],
    queryFn: () => api.get('/finance/stats').then((r) => r.data),
    enabled: canFinance,
  });

  const stats = [
    canInventory && {
      label: 'Products', value: String(inventory?.totalProducts ?? '—'),
      sub: inventory ? `${money(inventory.totalValue)} stock value` : 'Loading…',
      icon: Package, color: 'teal',
    },
    canProjects && {
      label: 'Active Projects', value: String(projects?.active ?? '—'),
      sub: projects ? `${projects.total ?? 0} total` : 'Loading…',
      icon: FolderKanban, color: 'blue',
    },
    canFinance && {
      label: 'Outstanding', value: finance ? money(finance.totalReceivables) : '—',
      sub: finance ? `${finance.overdueCount || 0} overdue invoices` : 'Loading…',
      icon: DollarSign, color: 'orange',
    },
    canSales && {
      label: 'Revenue (This Month)', value: sales ? money(sales.sales?.revenue) : '—',
      sub: sales ? `${sales.sales?.thisMonth || 0} orders this month` : 'Loading…',
      icon: Users, color: 'green',
    },
  ].filter(Boolean);

  const activity = [];
  for (const s of sales?.recentSales || []) {
    activity.push({
      type: 'sale',
      message: `Sale ${s.saleNumber} for ${s.client?.companyName || 'client'} — ${money(s.totalAmount)} (${s.status})`,
      time: timeAgo(s.createdAt),
      _date: new Date(s.createdAt).getTime(),
    });
  }
  for (const p of (inventory?.lowStockList || []).slice(0, 3)) {
    activity.push({
      type: 'alert',
      message: `Low stock: ${p.name} — ${p.quantity} ${p.unitType || 'units'} left (min ${p.minThreshold})`,
      time: 'needs reorder',
      _date: 0,
    });
  }
  activity.sort((a, b) => b._date - a._date);

  return (
    <div className="space-y-6">
      {stats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((s) => <StatsCard key={s.label} {...s} />)}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeed items={activity} />
        </div>
        <div>
          <QuickActions actions={QUICK_ACTIONS} />
        </div>
      </div>
    </div>
  );
}
