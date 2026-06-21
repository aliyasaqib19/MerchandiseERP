import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Plus, FileText, TrendingDown, TrendingUp,
  DollarSign, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import TransactionForm from '../../components/clients/TransactionForm';
import api from '../../lib/api';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(n || 0);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const TYPE_LABELS = {
  INVOICE:     { label: 'Invoice',     bg: 'bg-orange-50 text-orange-700 border-orange-200' },
  PAYMENT:     { label: 'Payment',     bg: 'bg-green-50 text-green-700 border-green-200' },
  CREDIT_NOTE: { label: 'Credit Note', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  DEBIT_NOTE:  { label: 'Debit Note',  bg: 'bg-orange-50 text-orange-700 border-orange-200' },
};

const PAGE_SIZE = 20;

export default function ClientLedgerPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [showAddTx, setShowAddTx] = useState(false);

  const { data: client } = useQuery({
    queryKey: ['client-basic', id],
    queryFn: () => api.get(`/clients/${id}`).then((r) => r.data),
    select: (d) => ({ id: d.id, companyName: d.companyName, outstandingBalance: d.outstandingBalance }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['client-ledger', id, page, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page, limit: PAGE_SIZE });
      if (typeFilter) params.set('type', typeFilter);
      return api.get(`/clients/${id}/ledger?${params}`).then((r) => r.data);
    },
    keepPreviousData: true,
  });

  const addTx = useMutation({
    mutationFn: (body) => api.post(`/clients/${id}/transactions`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-ledger', id] });
      queryClient.invalidateQueries({ queryKey: ['client-basic', id] });
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      setShowAddTx(false);
    },
  });

  const ledger   = Array.isArray(data) ? data : (data?.transactions ?? []);
  const total    = data?.total ?? ledger.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const totalDebits  = ledger.reduce((s, r) => s + (r.debit  || 0), 0);
  const totalCredits = ledger.reduce((s, r) => s + (r.credit || 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <Link
        to={`/clients/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to {client?.companyName || 'Client'}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Account Ledger</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{client?.companyName}</p>
        </div>
        <Button onClick={() => setShowAddTx(true)}>
          <Plus className="w-4 h-4" /> Add Transaction
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Debits</p>
            <p className="text-lg font-bold text-orange-600">{fmt(totalDebits)}</p>
          </div>
        </div>
        <div className="border rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Credits</p>
            <p className="text-lg font-bold text-green-600">{fmt(totalCredits)}</p>
          </div>
        </div>
        <div className="border rounded-xl p-4 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            (client?.outstandingBalance || 0) > 0 ? 'bg-orange-50' : 'bg-green-50'
          }`}>
            <DollarSign className={`w-5 h-5 ${
              (client?.outstandingBalance || 0) > 0 ? 'text-orange-500' : 'text-green-500'
            }`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Outstanding Balance</p>
            <p className={`text-lg font-bold ${
              (client?.outstandingBalance || 0) > 0 ? 'text-orange-600' : 'text-green-600'
            }`}>
              {fmt(client?.outstandingBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="w-44">
          <option value="">All Types</option>
          <option value="INVOICE">Invoice</option>
          <option value="PAYMENT">Payment</option>
          <option value="CREDIT_NOTE">Credit Note</option>
          <option value="DEBIT_NOTE">Debit Note</option>
        </Select>
        <span className="text-xs text-muted-foreground">{total} transaction{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Ledger Table */}
      <div className="border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Reference</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Description</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Due Date</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Debit</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Credit</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : ledger.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No transactions found</p>
                    <Button variant="outline" className="mt-3" onClick={() => setShowAddTx(true)}>
                      <Plus className="w-4 h-4" /> Add First Transaction
                    </Button>
                  </td>
                </tr>
              ) : (
                ledger.map((tx) => {
                  const cfg = TYPE_LABELS[tx.type] || {};
                  return (
                    <tr key={tx.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(tx.date)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {tx.reference || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.bg}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs truncate">{tx.description}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(tx.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-orange-600">
                        {tx.debit ? fmt(tx.debit) : ''}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-medium text-green-600">
                        {tx.credit ? fmt(tx.credit) : ''}
                      </td>
                      <td className={`px-4 py-3 text-right text-xs font-bold ${
                        tx.balance > 0 ? 'text-orange-600' : tx.balance < 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {fmt(tx.balance)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {ledger.length > 0 && (
              <tfoot className="bg-muted/40 border-t">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-xs font-semibold text-right text-muted-foreground">Page Totals</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-orange-600">{fmt(totalDebits)}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-green-600">{fmt(totalCredits)}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold">{fmt(client?.outstandingBalance)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Add Transaction Dialog */}
      <Dialog open={showAddTx} onOpenChange={setShowAddTx}>
        <DialogContent onClose={() => setShowAddTx(false)}>
          <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
          <TransactionForm
            isLoading={addTx.isPending}
            onSubmit={(data) => addTx.mutate(data)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
