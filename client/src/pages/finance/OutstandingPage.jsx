import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
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

function AgingChip({ bucket, daysOverdue }) {
  const map = {
    current: 'bg-green-50 text-green-700 border-green-200',
    '1_30':  'bg-yellow-50 text-yellow-700 border-yellow-200',
    '31_60': 'bg-orange-50 text-orange-700 border-orange-200',
    '61_90': 'bg-red-50 text-red-700 border-red-200',
    '90_plus': 'bg-red-100 text-red-800 border-red-300',
  };
  const labels = {
    current: 'Current',
    '1_30':  '1–30 days',
    '31_60': '31–60 days',
    '61_90': '61–90 days',
    '90_plus': '90+ days',
  };
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${map[bucket]}`}>
      {labels[bucket]}{daysOverdue > 0 ? ` (${daysOverdue}d)` : ''}
    </span>
  );
}

export default function OutstandingPage() {
  const qc = useQueryClient();
  const [payingClient, setPayingClient] = useState(null);

  const { data: clients = [], isLoading, refetch } = useQuery({
    queryKey: ['finance-outstanding'],
    queryFn: () => api.get('/finance/outstanding').then((r) => r.data),
  });

  const totalOutstanding = clients.reduce((s, c) => s + c.outstandingBalance, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Clock className="w-6 h-6" /> Outstanding Balances</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Clients with unpaid balances</p>
        </div>
        {clients.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total Outstanding</p>
            <p className="text-xl font-bold text-orange-600">{fmt(totalOutstanding)}</p>
          </div>
        )}
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Outstanding</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Oldest Due</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Aging</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Credit Limit</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && clients.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No outstanding balances — all clients are settled!</p>
              </td></tr>
            )}
            {clients.map((c) => {
              const overLimit = c.creditLimit && c.outstandingBalance > c.creditLimit;
              return (
                <tr key={c.id} className={`hover:bg-muted/20 ${c.isOverdue ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <Link to={`/clients/${c.id}`} className="font-medium hover:underline text-primary">
                      {c.companyName}
                    </Link>
                    {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold ${c.outstandingBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                      {fmt(c.outstandingBalance)}
                    </span>
                    {overLimit && (
                      <p className="text-xs text-red-600 font-medium">Over limit</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(c.oldestDueDate)}</td>
                  <td className="px-4 py-3">
                    <AgingChip bucket={c.agingBucket} daysOverdue={c.daysOverdue} />
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {c.creditLimit ? fmt(c.creditLimit) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPayingClient(c)}
                        className="text-green-700 border-green-300 hover:bg-green-50"
                      >
                        <Plus className="w-3 h-3" /> Pay
                      </Button>
                      <Link to={`/clients/${c.id}/ledger`}>
                        <Button size="sm" variant="ghost">Ledger</Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quick Pay Dialog */}
      <Dialog open={!!payingClient} onOpenChange={(o) => { if (!o) setPayingClient(null); }}>
        <DialogContent onClose={() => setPayingClient(null)}>
          <DialogHeader>
            <DialogTitle>Record Payment — {payingClient?.companyName}</DialogTitle>
          </DialogHeader>
          {payingClient && (
            <PaymentForm
              defaultClientId={payingClient.id}
              onSuccess={() => {
                setPayingClient(null);
                qc.invalidateQueries({ queryKey: ['finance-outstanding'] });
                qc.invalidateQueries({ queryKey: ['finance-stats'] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
