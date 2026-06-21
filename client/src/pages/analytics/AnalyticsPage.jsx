import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2, TrendingUp, Package, Users, FolderKanban, DollarSign,
  Loader2, Download, Calendar, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import api from '../../lib/api';

function fmt(n, currency = false) {
  if (n === undefined || n === null) return '—';
  if (currency) return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 }).format(n);
  return new Intl.NumberFormat('en-US').format(n);
}

function StatCard({ label, value, sub, icon: Icon, color = 'bg-primary/10 text-primary', trend }) {
  return (
    <div className="bg-white border rounded-xl p-5 space-y-3">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium flex items-center gap-0.5 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, color }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
    </div>
  );
}

function BarMini({ value, max, color = 'bg-primary' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-muted rounded-full h-1.5">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Sales Report ──────────────────────────────────────────────────────────────

function SalesSection({ from, to }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-sales', from, to],
    queryFn: () => api.get('/analytics/sales', { params: { from: from || undefined, to: to || undefined } }).then((r) => r.data),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const maxClient = Math.max(...(data.topClients?.map((c) => c.totalAmount) || [1]));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Revenue"   value={fmt(data.summary?.totalRevenue,  true)} icon={TrendingUp}  color="bg-green-50 text-green-600" />
        <StatCard label="Orders"          value={fmt(data.summary?.count)}               icon={BarChart2}   color="bg-blue-50 text-blue-600"  />
        <StatCard label="Total Discounts" value={fmt(data.summary?.totalDiscount, true)} icon={ArrowDownRight} color="bg-amber-50 text-amber-600" />
        <StatCard label="Total Tax"       value={fmt(data.summary?.totalTax,      true)} icon={DollarSign}  color="bg-purple-50 text-purple-600" />
      </div>

      {data.topClients?.length > 0 && (
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Top Clients by Revenue</h3>
          <div className="space-y-3">
            {data.topClients.map((c, i) => (
              <div key={c.clientId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium flex items-center gap-2">
                    <span className="text-muted-foreground text-xs w-5">#{i + 1}</span>
                    {c.companyName}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{c.count} orders</span>
                    <span className="font-semibold">{fmt(c.totalAmount, true)}</span>
                  </div>
                </div>
                <BarMini value={c.totalAmount} max={maxClient} color="bg-green-500" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inventory Report ──────────────────────────────────────────────────────────

function InventorySection() {
  const { data, isLoading } = useQuery({
    queryKey: ['report-inventory'],
    queryFn: () => api.get('/analytics/inventory').then((r) => r.data),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Active Products"    value={fmt(data.summary?.totalProducts)}             icon={Package}  color="bg-blue-50 text-blue-600"   />
        <StatCard label="Total Stock Units"  value={fmt(data.summary?.totalUnits)}                icon={BarChart2} color="bg-purple-50 text-purple-600" />
        <StatCard label="Stock Cost Value"   value={fmt(data.summary?.totalCostValue, true)}      icon={DollarSign} color="bg-amber-50 text-amber-600" />
        <StatCard label="Stock Selling Value" value={fmt(data.summary?.totalSellingValue, true)}  icon={TrendingUp} color="bg-green-50 text-green-600" />
      </div>

      {data.categories?.length > 0 && (
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Products by Category</h3>
          <div className="space-y-2.5">
            {data.categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span>{c.name}</span>
                <span className="font-medium text-primary">{c.productCount} products</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.movementSummary?.length > 0 && (
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Movement Breakdown</h3>
          <div className="space-y-2.5">
            {data.movementSummary.map((m) => (
              <div key={m.type} className="flex items-center justify-between text-sm">
                <span className="capitalize text-muted-foreground">{m.type.replace(/_/g, ' ')}</span>
                <div className="flex gap-4">
                  <span className="text-muted-foreground">{fmt(m._count.id)} txns</span>
                  <span className="font-medium">{fmt(m._sum.quantity)} units</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Projects Report ───────────────────────────────────────────────────────────

function ProjectsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['report-projects'],
    queryFn: () => api.get('/analytics/projects').then((r) => r.data),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const STATUS_COLORS = {
    PLANNING:  'bg-blue-500',
    ACTIVE:    'bg-green-500',
    ON_HOLD:   'bg-amber-500',
    COMPLETED: 'bg-teal-500',
    CLOSED:    'bg-gray-500',
    CANCELLED: 'bg-red-500',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total Projects"        value={fmt(data.total)}                    icon={FolderKanban} color="bg-teal-50 text-teal-600" />
        <StatCard label="Avg Completion (days)" value={data.avgCompletionDays || '—'}      icon={Calendar}     color="bg-purple-50 text-purple-600" />
      </div>

      {data.byStatus?.length > 0 && (
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Projects by Status</h3>
          <div className="space-y-3">
            {data.byStatus.map((s) => (
              <div key={s.status} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{s.status.replace(/_/g, ' ')}</span>
                  <span className="text-primary font-semibold">{s._count.id}</span>
                </div>
                <BarMini value={s._count.id} max={data.total} color={STATUS_COLORS[s.status] || 'bg-gray-500'} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Finance Report ────────────────────────────────────────────────────────────

function FinanceSection({ from, to }) {
  const { data, isLoading } = useQuery({
    queryKey: ['report-finance', from, to],
    queryFn: () => api.get('/analytics/finance', { params: { from: from || undefined, to: to || undefined } }).then((r) => r.data),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const collectionRate = data.invoiced?.total > 0
    ? Math.round((data.collected?.total / data.invoiced?.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Invoiced"   value={fmt(data.invoiced?.total,   true)} icon={DollarSign}    color="bg-blue-50   text-blue-600"  />
        <StatCard label="Collected"        value={fmt(data.collected?.total,  true)} icon={TrendingUp}    color="bg-green-50  text-green-600" />
        <StatCard label="Outstanding"      value={fmt(data.outstanding?.total, true)} icon={BarChart2}    color="bg-amber-50  text-amber-600" />
        <StatCard label="Overdue Invoices" value={fmt(data.overdueCount)}             icon={Calendar}     color="bg-red-50    text-red-600"   />
      </div>

      <div className="bg-white border rounded-xl p-5">
        <h3 className="font-semibold mb-3">Collection Rate</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Collected vs Invoiced</span>
            <span className="font-bold text-lg">{collectionRate}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${collectionRate >= 80 ? 'bg-green-500' : collectionRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${collectionRate}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{fmt(data.collected?.total, true)} collected</span>
            <span>{fmt(data.invoiced?.total, true)} invoiced</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Clients Report ────────────────────────────────────────────────────────────

function ClientsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['report-clients'],
    queryFn: () => api.get('/analytics/clients').then((r) => r.data),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;

  const STATUS_COLORS = { ACTIVE: 'bg-green-500', INACTIVE: 'bg-gray-400', PROSPECT: 'bg-blue-500', BLACKLISTED: 'bg-red-500' };
  const maxPaid = Math.max(...(data.topByRevenue?.map((c) => c.totalPaid) || [1]));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total Clients" value={fmt(data.total)} icon={Users} color="bg-purple-50 text-purple-600" />
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold mb-3 text-sm">By Status</h3>
          <div className="space-y-1.5">
            {data.byStatus?.map((s) => (
              <div key={s.status} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[s.status] || 'bg-gray-400'}`} />
                  <span className="text-muted-foreground">{s.status}</span>
                </div>
                <span className="font-medium">{s._count.id}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data.topByRevenue?.length > 0 && (
        <div className="bg-white border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Top Clients by Payments Received</h3>
          <div className="space-y-3">
            {data.topByRevenue.map((c, i) => (
              <div key={c.clientId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs w-5">#{i + 1}</span>
                    <span className="font-medium">{c.companyName}</span>
                  </span>
                  <span className="font-semibold">{fmt(c.totalPaid, true)}</span>
                </div>
                <BarMini value={c.totalPaid} max={maxPaid} color="bg-purple-500" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'sales',     label: 'Sales',     icon: TrendingUp,   color: 'bg-green-50 text-green-600'   },
  { key: 'inventory', label: 'Inventory', icon: Package,      color: 'bg-blue-50 text-blue-600'     },
  { key: 'projects',  label: 'Projects',  icon: FolderKanban, color: 'bg-teal-50 text-teal-600'     },
  { key: 'finance',   label: 'Finance',   icon: DollarSign,   color: 'bg-amber-50 text-amber-600'   },
  { key: 'clients',   label: 'Clients',   icon: Users,        color: 'bg-purple-50 text-purple-600' },
];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('sales');
  const [from, setFrom]           = useState('');
  const [to,   setTo]             = useState('');

  const tab = TABS.find((t) => t.key === activeTab);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" /> Analytics & Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Business intelligence across all operational modules</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Period:</span>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
          <span className="text-muted-foreground">to</span>
          <Input type="date" value={to}   onChange={(e) => setTo(e.target.value)}   className="w-36" />
          {(from || to) && (
            <Button variant="outline" size="sm" onClick={() => { setFrom(''); setTo(''); }}>Clear</Button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap -mb-px ${
                activeTab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Active section */}
      <div>
        <SectionHeader icon={tab.icon} title={`${tab.label} Report`} color={tab.color} />
        {activeTab === 'sales'     && <SalesSection     from={from} to={to} />}
        {activeTab === 'inventory' && <InventorySection />}
        {activeTab === 'projects'  && <ProjectsSection  />}
        {activeTab === 'finance'   && <FinanceSection   from={from} to={to} />}
        {activeTab === 'clients'   && <ClientsSection   />}
      </div>
    </div>
  );
}
