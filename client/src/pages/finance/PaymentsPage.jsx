import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import PaymentForm from '../../components/finance/PaymentForm';
import api from '../../lib/api';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(n || 0);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const METHOD_BADGE = {
  'Bank Transfer': 'bg-blue-50 text-blue-700',
  'Cash':          'bg-green-50 text-green-700',
  'Cheque':        'bg-purple-50 text-purple-700',
  'Online / Card': 'bg-cyan-50 text-cyan-700',
  'Other':         'bg-gray-50 text-gray-700',
};

export default function PaymentsPage() {
  const qc = useQueryClient();
  const [page,     setPage]     = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [showNew,  setShowNew]  = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['finance-payments', page, dateFrom, dateTo],
    queryFn: () => {
      const params = new URLSearchParams({ page, limit: 50 });
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo)   params.set('dateTo',   dateTo);
      return api.get(`/finance/payments?${params}`).then((r) => r.data);
    },
    keepPreviousData: true,
  });

  const payments = data?.payments || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CreditCard className="w-6 h-6" /> Payments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All recorded client payments</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="bg-green-600 hover:bg-green-700 text-white">
          <Plus className="w-4 h-4" /> Record Payment
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap border rounded-xl p-4 bg-muted/20">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Date From</p>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-40" />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Date To</p>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-40" />
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}>Clear</Button>
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Method</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reference</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Recorded By</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && payments.length === 0 && (
              <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">No payments found</td></tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(p.date)}</td>
                <td className="px-4 py-3 font-medium">{p.client?.companyName}</td>
                <td className="px-4 py-3">
                  {p.paymentMethod ? (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${METHOD_BADGE[p.paymentMethod] || 'bg-gray-50 text-gray-700'}`}>
                      {p.paymentMethod}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.reference || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{p.description || '—'}</td>
                <td className="px-4 py-3 text-right font-bold text-green-600">+{fmt(p.amount)}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{p.user?.fullName || '—'}</td>
              </tr>
            ))}
          </tbody>
          {payments.length > 0 && (
            <tfoot className="bg-muted/20 border-t">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-sm font-medium">Page total</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-green-600">
                  +{fmt(payments.reduce((s, p) => s + p.amount, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {data.page} of {data.pages} · {data.total} payments</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <Button variant="outline" size="sm" disabled={data.page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* New Payment Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent onClose={() => setShowNew(false)}>
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <PaymentForm
            onSuccess={() => {
              setShowNew(false);
              qc.invalidateQueries({ queryKey: ['finance-payments'] });
              qc.invalidateQueries({ queryKey: ['finance-stats'] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
