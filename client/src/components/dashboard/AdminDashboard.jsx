import {
  Users, Shield, Package, FolderKanban, DollarSign, Activity,
  UserPlus, ShieldPlus,
} from 'lucide-react';
import { StatsCard } from './StatsCard';
import { ActivityFeed } from './ActivityFeed';
import { QuickActions } from './QuickActions';

const STATS = [
  { label: 'Total Users',      value: '24',      sub: '3 added this month',   icon: Users,       color: 'blue',   trend: 'up',   trendValue: '+3' },
  { label: 'Active Roles',     value: '7',       sub: '2 custom roles',        icon: Shield,      color: 'purple', trend: null },
  { label: 'Total Modules',    value: '8',       sub: 'All systems operational', icon: Activity,  color: 'green',  trend: null },
  { label: 'Pending Approvals',value: '5',       sub: 'Requires attention',    icon: FolderKanban,color: 'orange', trend: 'up',   trendValue: '+2' },
];

const ACTIVITY = [
  { type: 'user',     message: 'New user "Sara Ahmed" added as Sales Manager',   time: '10 min ago' },
  { type: 'user',     message: 'Role "Warehouse Manager" created by admin',      time: '1 hour ago' },
  { type: 'project',  message: 'Project "Branch C Cabling" marked as complete',  time: '3 hours ago' },
  { type: 'finance',  message: 'Payment #PAY-0091 of $4,500 confirmed',          time: 'Yesterday' },
  { type: 'alert',    message: 'Failed login attempt detected for user@corp.com', time: 'Yesterday' },
  { type: 'user',     message: 'User "Khalid Saeed" status set to Inactive',     time: '2 days ago' },
];

const QUICK_ACTIONS = [
  { label: 'Add User',    icon: UserPlus,   to: '/users',   primary: true },
  { label: 'New Role',    icon: ShieldPlus, to: '/roles',   primary: false },
  { label: 'Inventory',   icon: Package,    to: '/inventory', primary: false },
  { label: 'Finance',     icon: DollarSign, to: '/finance', primary: false },
];

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATS.map((s) => <StatsCard key={s.label} {...s} />)}
      </div>

      {/* Body */}
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
