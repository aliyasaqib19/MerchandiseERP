import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FileText, ShoppingCart, TrendingUp, DollarSign,
  Package, Clock, CheckCircle2, Truck,
} from 'lucide-react';
import { StatsCard } from '../../components/dashboard/StatsCard';
import { SalesStatusBadge } from '../../components/sales/SalesStatusBadge';
import api from '../../lib/api';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n || 0);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SalesDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['sales-dashboard-stats'],
    queryFn: () => api.get('/sales/stats').then((r) => r.data),
  });

  const STAT_CARDS = [
    {
      label: 'Revenue This Month',
      value: fmt(stats?.sales?.revenue),
      icon: DollarSign,
      color: 'green',
    },
    {
      label: 'Sales Confirmed',
      value: String(stats?.sales?.confirmed ?? '—'),
      icon: CheckCircle2,
      color: 'indigo',
    },
    {
      label: 'Quotations Pending',
      value: String(stats?.quotations?.sent ?? '—'),
      icon: FileText,
      color: 'blue',
    },
    {
      label: 'POs Awaiting Approval',
      value: String(stats?.purchaseOrders?.pending ?? '—'),
      icon: ShoppingCart,
      color: 'orange',
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sales Overview</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Sales workflow — Quotations → POs → Sales → Invoices</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAT_CARDS.map((s) => <StatsCard key={s.label} {...s} loading={isLoading} />)}
      </div>

      {/* Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quotation Pipeline */}
        <div className="border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" /> Quotations
            </h3>
            <Link to="/sales/quotations" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {['draft', 'sent', 'approved'].map((k) => (
              <div key={k} className="border rounded-lg p-2">
                <p className="text-2xl font-bold">{stats?.quotations?.[k] ?? '—'}</p>
                <p className="text-xs text-muted-foreground capitalize">{k}</p>
              </div>
            ))}
          </div>
        </div>

        {/* PO Pipeline */}
        <div className="border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-orange-500" /> Purchase Orders
            </h3>
            <Link to="/sales/purchase-orders" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            {['pending', 'approved'].map((k) => (
              <div key={k} className="border rounded-lg p-2">
                <p className="text-2xl font-bold">{stats?.purchaseOrders?.[k] ?? '—'}</p>
                <p className="text-xs text-muted-foreground capitalize">{k}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sales Pipeline */}
        <div className="border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-500" /> Sales Orders
            </h3>
            <Link to="/sales/orders" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { key: 'thisMonth', label: 'this month' },
              { key: 'confirmed', label: 'confirmed' },
              { key: 'delivered', label: 'delivered' },
            ].map(({ key, label }) => (
              <div key={key} className="border rounded-lg p-2">
                <p className="text-2xl font-bold">{stats?.sales?.[key] ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Workflow diagram */}
      <div className="border rounded-xl p-5">
        <h3 className="font-semibold text-sm mb-4">ERP Sales Workflow</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {[
            { icon: FileText,    label: 'Quotation',     link: '/sales/quotations',      color: 'bg-blue-100 text-blue-700' },
            null,
            { icon: ShoppingCart, label: 'Purchase Order', link: '/sales/purchase-orders', color: 'bg-orange-100 text-orange-700' },
            null,
            { icon: Package,     label: 'Sale',          link: '/sales/orders',          color: 'bg-indigo-100 text-indigo-700' },
            null,
            { icon: TrendingUp,  label: 'Inv. Deduction', link: null,                     color: 'bg-red-100 text-red-700' },
            null,
            { icon: DollarSign,  label: 'Invoice',       link: null,                     color: 'bg-green-100 text-green-700' },
          ].map((step, i) => {
            if (step === null) {
              return <span key={i} className="text-muted-foreground font-bold">→</span>;
            }
            const Icon = step.icon;
            const content = (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium ${step.color}`}>
                <Icon className="w-3.5 h-3.5" />{step.label}
              </div>
            );
            return step.link ? (
              <Link key={step.label} to={step.link}>{content}</Link>
            ) : (
              <div key={step.label}>{content}</div>
            );
          })}
        </div>
      </div>

      {/* Recent Sales */}
      {stats?.recentSales?.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
            <h3 className="font-semibold text-sm">Recent Sales</h3>
            <Link to="/sales/orders" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y">
            {stats.recentSales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20">
                <div>
                  <p className="text-sm font-medium">{sale.saleNumber}</p>
                  <p className="text-xs text-muted-foreground">{sale.client?.companyName} · {fmtDate(sale.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{fmt(sale.totalAmount)}</span>
                  <SalesStatusBadge status={sale.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
