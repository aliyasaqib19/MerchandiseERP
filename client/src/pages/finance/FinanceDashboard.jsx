import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign, AlertTriangle, TrendingUp, FileText, Plus,
  CreditCard, Clock,
} from 'lucide-react';
import { StatsCard } from '../../components/dashboard/StatsCard';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import PaymentForm from '../../components/finance/PaymentForm';
import api from '../../lib/api';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n || 0);
}
function fmtFull(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(n || 0);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const METHOD_ICON = { 'Bank Transfer': '🏦', Cash: '💵', Cheque: '📄', 'Online / Card': '💳', Other: '💰' };

export default function FinanceDashboard() {
  const qc = useQueryClient();
  const [showPayment, setShowPayment] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['finance-stats'],
    queryFn: () => api.get('/finance/stats').then((r) => r.data),
  });

  const STAT_CARDS = [
    {
      label: 'Total Receivables',
      value: fmt(stats?.totalReceivables),
      icon: DollarSign,
      color: 'orange',
      sub: 'All outstanding client balances',
    },
    {
      label: 'Overdue Invoices',
      value: String(stats?.overdueCount ?? '—'),
      icon: AlertTriangle,
      color: 'red',
      sub: stats?.overdueAmount ? `${fmt(stats.overdueAmount)} overdue` : undefined,
    },
    {
      label: 'Collected This Month',
      value: fmt(stats?.collectedThisMonth),
      icon: TrendingUp,
      color: 'green',
    },
    {
      label: 'Invoiced This Month',
      value: fmt(stats?.invoicedThisMonth),
      icon: FileText,
      color: 'blue',
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Finance</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Cash flow, receivables &amp; payment tracking</p>
        </div>
        <Button onClick={() => setShowPayment(true)} className="bg-green-600 hover:bg-green-700 text-white">
          <Plus className="w-4 h-4" /> Record Payment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAT_CARDS.map((s) => <StatsCard key={s.label} {...s} loading={isLoading} />)}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Invoice List',     icon: FileText,    to: '/finance/invoices',    color: 'text-blue-600   bg-blue-50' },
          { label: 'Payments',         icon: CreditCard,  to: '/finance/payments',    color: 'text-green-600  bg-green-50' },
          { label: 'Outstanding',      icon: Clock,       to: '/finance/outstanding', color: 'text-orange-600 bg-orange-50' },
          { label: 'Aged Receivables', icon: AlertTriangle, to: '/finance/aged-receivables', color: 'text-red-600 bg-red-50' },
        ].map(({ label, icon: Icon, to, color }) => (
          <Link key={label} to={to}>
            <div className={`border rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-shadow ${color.split(' ')[1]}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-white/60`}>
                <Icon className={`w-5 h-5 ${color.split(' ')[0]}`} />
              </div>
              <span className={`text-sm font-semibold ${color.split(' ')[0]}`}>{label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Payments */}
      {stats?.recentPayments?.length > 0 && (
        <div className="border rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-muted/40 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Recent Payments</h3>
            <Link to="/finance/payments" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y">
            {stats.recentPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{METHOD_ICON[p.paymentMethod] || '💰'}</span>
                  <div>
                    <p className="text-sm font-medium">{p.client?.companyName}</p>
                    <p className="text-xs text-muted-foreground">{p.description} · {fmtDate(p.date)}</p>
                    {p.reference && <p className="text-xs text-muted-foreground">Ref: {p.reference}</p>}
                  </div>
                </div>
                <span className="text-sm font-bold text-green-600">+ {fmtFull(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent onClose={() => setShowPayment(false)}>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <PaymentForm
            onSuccess={() => {
              setShowPayment(false);
              qc.invalidateQueries({ queryKey: ['finance-stats'] });
              qc.invalidateQueries({ queryKey: ['finance-payments'] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
