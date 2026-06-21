import {
  FileText, Receipt, DollarSign, CheckCircle,
  FilePlus, Building2, Phone,
} from 'lucide-react';
import { StatsCard } from './StatsCard';
import { ActivityFeed } from './ActivityFeed';
import { QuickActions } from './QuickActions';

const STATS = [
  { label: 'Open Quotations',     value: '12',      sub: '4 awaiting client approval',  icon: FileText,    color: 'blue',   trend: 'up',   trendValue: '+3' },
  { label: 'Pending Invoices',    value: '8',       sub: '$46,200 total value',          icon: Receipt,     color: 'orange', trend: 'down', trendValue: '-1' },
  { label: 'Outstanding Balance', value: '$34,200', sub: 'From 5 clients',               icon: DollarSign,  color: 'red',    trend: 'down', trendValue: '-$4k' },
  { label: 'Closed Deals / Mo.',  value: '23',      sub: 'vs 18 last month',             icon: CheckCircle, color: 'green',  trend: 'up',   trendValue: '+28%' },
];

const ACTIVITY = [
  { type: 'sale',  message: 'Quotation #QT-0041 sent to Emirates Networks LLC',      time: '15 min ago' },
  { type: 'sale',  message: 'Invoice #INV-0058 paid by Al-Barakah Contracting',      time: '1 hour ago' },
  { type: 'sale',  message: 'New client "Noor Telecom" added to the system',         time: '3 hours ago' },
  { type: 'sale',  message: 'Quotation #QT-0039 approved — value $18,500',           time: 'Yesterday' },
  { type: 'alert', message: 'Invoice #INV-0047 is 15 days overdue',                  time: 'Yesterday' },
  { type: 'sale',  message: 'Payment reminder sent to Gulf Contracting Co.',          time: '2 days ago' },
];

const QUICK_ACTIONS = [
  { label: 'New Quotation', icon: FilePlus,   to: '/sales/quotations', primary: true },
  { label: 'New Invoice',   icon: Receipt,    to: '/sales/invoices',   primary: false },
  { label: 'Add Client',    icon: Building2,  to: '/clients',          primary: false },
  { label: 'Follow-Up',     icon: Phone,      to: '/clients/contacts', primary: false },
];

export function SalesDashboard() {
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
