import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, FileText, Filter } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import api from '../../lib/api';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(n || 0);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_OPTIONS = [
  { value: '',        label: 'All Invoices' },
  { value: 'overdue', label: 'Overdue Only' },
  { value: 'no_due',  label: 'No Due Date' },
];

export default function InvoiceListPage() {
  const [page,     setPage]     = useState(1);
  const [status,   setStatus]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['finance-invoices', page, status, dateFrom, dateTo],
    queryFn: () => {
      const params = new URLSearchParams({ page, limit: 50 });
      if (status)   params.set('status',   status);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo)   params.set('dateTo',   dateTo);
      return api.get(`/finance/invoices?${params}`).then((r) => r.data);
    },
    keepPreviousData: true,
  });

  const invoices = data?.invoices || [];

  function handleFilter() { setPage(1); }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6" /> Invoice List</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All issued invoices across clients</p>
        </div>
        {data?.total !== undefined && (
          <span className="text-sm text-muted-foreground">{data.total} total</span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 border rounded-xl p-4 bg-muted/20">
        <Filter className="w-4 h-4 text-muted-foreground mt-5" />
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Status</p>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Date From</p>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Date To</p>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
        <Button onClick={handleFilter} size="sm">Apply</Button>
        <Button
          variant="ghost" size="sm"
          onClick={() => { setStatus(''); setDateFrom(''); setDateTo(''); setPage(1); }}
        >
          Clear
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Reference</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice Date</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Client Balance</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Sale</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Loading…</td></tr>
            )}
            {!isLoading && invoices.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">No invoices found</td></tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className={`hover:bg-muted/20 ${inv.isOverdue ? 'bg-red-50/50' : ''}`}>
                <td className="px-4 py-3 font-mono text-xs">{inv.reference || `#${inv.id}`}</td>
                <td className="px-4 py-3">
                  <Link to={`/clients/${inv.clientId}`} className="hover:underline text-primary font-medium">
                    {inv.client?.companyName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(inv.date)}</td>
                <td className="px-4 py-3">
                  {inv.dueDate ? (
                    <span className={inv.isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                      {fmtDate(inv.dueDate)}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-right font-semibold">{fmt(inv.amount)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={inv.clientBalance > 0 ? 'text-orange-600 font-medium' : 'text-green-600'}>
                    {fmt(inv.clientBalance)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {inv.isOverdue ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                      <AlertTriangle className="w-3 h-3" />
                      {inv.daysOverdue}d overdue
                    </span>
                  ) : (
                    <span className="inline-flex text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                      Current
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {inv.sale ? (
                    <Link to={`/sales/orders`} className="text-xs text-primary hover:underline">
                      {inv.sale.saleNumber}
                    </Link>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {data.page} of {data.pages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <Button variant="outline" size="sm" disabled={data.page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
