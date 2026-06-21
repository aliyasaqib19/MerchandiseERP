import {
  Package, FolderKanban, DollarSign, TrendingUp,
  UserPlus, FilePlus, FolderPlus, FileText,
} from 'lucide-react';
import { StatsCard } from './StatsCard';
import { ActivityFeed } from './ActivityFeed';
import { QuickActions } from './QuickActions';

const STATS = [
  { label: 'Inventory Value',    value: '$128,400', sub: 'Across all warehouses',       icon: Package,       color: 'teal',   trend: 'up',   trendValue: '+4.2%' },
  { label: 'Active Projects',    value: '18',       sub: '3 due this week',              icon: FolderKanban,  color: 'blue',   trend: 'down', trendValue: '-2' },
  { label: 'Pending Payments',   value: '$34,200',  sub: '7 outstanding invoices',       icon: DollarSign,    color: 'orange', trend: 'up',   trendValue: '+$8k' },
  { label: 'Monthly Revenue',    value: '$87,500',  sub: 'vs $72,100 last month',        icon: TrendingUp,    color: 'green',  trend: 'up',   trendValue: '+21%' },
];

const ACTIVITY = [
  { type: 'project',  message: 'Project "Network Upgrade – HQ" started by team',      time: '20 min ago' },
  { type: 'sale',     message: 'Invoice #INV-0055 sent to Al-Rashid Trading Co.',      time: '1 hour ago' },
  { type: 'finance',  message: 'Payment $12,000 received from Gulf Telecom',           time: '2 hours ago' },
  { type: 'inventory',message: 'Stock replenishment order #PO-0021 approved',          time: '4 hours ago' },
  { type: 'user',     message: 'New technician "Rami Hassan" assigned to Branch B',   time: 'Yesterday' },
  { type: 'sale',     message: 'Quotation #QT-0033 approved — value $28,000',         time: 'Yesterday' },
  { type: 'alert',    message: 'Low stock: Fiber Cable OM3 (only 120m remaining)',     time: '2 days ago' },
];

const QUICK_ACTIONS = [
  { label: 'New User',      icon: UserPlus,   to: '/users',             primary: true },
  { label: 'New Project',   icon: FolderPlus, to: '/projects',          primary: false },
  { label: 'New Invoice',   icon: FilePlus,   to: '/sales/invoices',    primary: false },
  { label: 'Reports',       icon: FileText,   to: '/finance',           primary: false },
];

export function RMDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATS.map((s) => <StatsCard key={s.label} {...s} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityFeed items={ACTIVITY} />
        </div>
        <div>
          <QuickActions actions={QUICK_ACTIONS} />
        </div>
      </div>
    </div>
  );
}
