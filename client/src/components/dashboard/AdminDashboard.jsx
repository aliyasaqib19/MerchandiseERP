import { useQuery } from '@tanstack/react-query';
import {
  Users, Package, DollarSign, ClipboardCheck,
  UserPlus, ShieldPlus,
} from 'lucide-react';
import { StatsCard } from './StatsCard';
import { ActivityFeed } from './ActivityFeed';
import { QuickActions } from './QuickActions';
import { useWarehouseStore } from '../../store/warehouseStore';
import api from '../../lib/api';

const QUICK_ACTIONS = [
  { label: 'Add User',    icon: UserPlus,   to: '/users',     primary: true },
  { label: 'New Role',    icon: ShieldPlus, to: '/roles',     primary: false },
  { label: 'Inventory',   icon: Package,    to: '/inventory', primary: false },
  { label: 'Finance',     icon: DollarSign, to: '/finance',   primary: false },
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

export function AdminDashboard() {
  const activeWarehouse = useWarehouseStore((s) => s.activeWarehouse);
  const whId = activeWarehouse?.id;

  const { data: inventory } = useQuery({
    queryKey: ['dash-inventory', whId],
    queryFn: () => api.get('/inventory/stats').then((r) => r.data),
  });
  const { data: clients } = useQuery({
    queryKey: ['dash-clients', whId],
    queryFn: () => api.get('/clients/stats').then((r) => r.data),
  });
  const { data: sales } = useQuery({
    queryKey: ['dash-sales', whId],
    queryFn: () => api.get('/sales/stats').then((r) => r.data),
  });
  const { data: approvals } = useQuery({
    queryKey: ['dash-approvals', whId],
    queryFn: () => api.get('/approvals/stats').then((r) => r.data),
  });

  const stats = [
    {
      label: 'Products', value: String(inventory?.totalProducts ?? '—'),
      sub: inventory ? `${money(inventory.totalValue)} stock value` : 'Loading…',
      icon: Package, color: 'blue',
    },
    {
      label: 'Clients', value: String(clients?.totalClients ?? '—'),
      sub: clients ? `${clients.newThisMonth} new this month` : 'Loading…',
      icon: Users, color: 'purple',
      trend: clients?.newThisMonth > 0 ? 'up' : null,
      trendValue: clients?.newThisMonth > 0 ? `+${clients.newThisMonth}` : undefined,
    },
    {
      label: 'Revenue (This Month)', value: sales ? money(sales.sales?.revenue) : '—',
      sub: sales ? `${sales.sales?.thisMonth || 0} orders this month` : 'Loading…',
      icon: DollarSign, color: 'green',
    },
    {
      label: 'Pending Approvals', value: String(approvals?.pending ?? '—'),
      sub: approvals ? `${approvals.approved || 0} approved` : 'Loading…',
      icon: ClipboardCheck, color: 'orange',
      trend: approvals?.pending > 0 ? 'up' : null,
      trendValue: approvals?.pending > 0 ? `${approvals.pending}` : undefined,
    },
  ];

  // Build a real, warehouse-scoped activity feed from recent records
  const activity = [];
  for (const s of sales?.recentSales || []) {
    activity.push({
      type: 'sale',
      message: `Sale ${s.saleNumber} for ${s.client?.companyName || 'client'} — ${money(s.totalAmount)} (${s.status})`,
      time: timeAgo(s.createdAt),
      _date: new Date(s.createdAt).getTime(),
    });
  }
  for (const c of clients?.recentClients || []) {
    activity.push({
      type: 'user',
      message: `Client "${c.companyName}" added${c.industry ? ` · ${c.industry}` : ''}`,
      time: timeAgo(c.createdAt),
      _date: new Date(c.createdAt).getTime(),
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
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => <StatsCard key={s.label} {...s} />)}
      </div>

      {/* Body */}
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
