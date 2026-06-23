import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, ChevronLeft, ChevronRight, Download, SlidersHorizontal } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { TransactionTypeBadge } from '../../components/inventory/TransactionTypeBadge';
import api from '../../lib/api';

const TRANSACTION_TYPES = ['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'SALE', 'RETURN'];

export default function InventoryHistoryPage() {
  const [searchParams] = useSearchParams();
  const [productSearch, setProductSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  // Pre-fill product filter from URL param (from product detail page link)
  const productIdParam = searchParams.get('productId');

  const queryKey = ['inventory-transactions', { typeFilter, dateFrom, dateTo, page, productIdParam }];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (typeFilter) params.set('type', typeFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (productIdParam) params.set('productId', productIdParam);
      return api.get(`/inventory/transactions?${params}`).then((r) => r.data);
    },
  });

  const transactions = data?.transactions || [];
  const totalPages = data?.pages || 1;

  // Client-side product name filter (since API filters by ID, not name)
  const filtered = productSearch
    ? transactions.filter(
        (tx) =>
          tx.product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
          tx.product.sku.toLowerCase().includes(productSearch.toLowerCase())
      )
    : transactions;

  function exportCSV() {
    const rows = [
      ['Date', 'Product', 'Manufacture No.', 'Brand', 'Type', 'Quantity', 'Balance After', 'Reference', 'Notes', 'Created By'],
      ...filtered.map((tx) => [
        new Date(tx.createdAt).toLocaleString(),
        tx.product?.name || '',
        tx.product?.sku || '',
        tx.product?.brand?.name || '',
        tx.type,
        tx.quantity,
        tx.balanceAfter,
        tx.reference || '',
        tx.notes || '',
        tx.user?.fullName || '',
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-movements-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory History</h1>
          <p className="text-muted-foreground text-sm mt-0.5">All stock movements and adjustments</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="w-4 h-4" /> Export
        </Button>
      </div>

      {/* Filters */}
      <div className="border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <SlidersHorizontal className="w-4 h-4" /> Filters
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Filter by product name or SKU..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
            />
          </div>
          <Select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="w-40"
          >
            <option value="">All Types</option>
            {TRANSACTION_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </Select>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="w-40"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="w-40"
            />
          </div>
          {(typeFilter || dateFrom || dateTo || productSearch) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setTypeFilter(''); setDateFrom(''); setDateTo(''); setProductSearch(''); setPage(1); }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date & Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Product</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Brand</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Qty Change</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Balance After</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Reference</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Done By</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-muted-foreground">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                  <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(tx.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                      <br />
                      {new Date(tx.createdAt).toLocaleTimeString('en-US', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{tx.product.name}</p>
                      <span className="font-mono text-xs text-muted-foreground">{tx.product.sku}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{tx.product?.brand?.name || '—'}</td>
                    <td className="px-4 py-3"><TransactionTypeBadge type={tx.type} /></td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      <span className={
                        tx.type === 'STOCK_IN' || tx.type === 'RETURN' ? 'text-green-600' : 'text-red-600'
                      }>
                        {tx.type === 'STOCK_IN' || tx.type === 'RETURN' ? '+' : '-'}{tx.quantity}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">{tx.product.unitType}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">{tx.balanceAfter}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{tx.reference || '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{tx.user?.fullName}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                      {tx.notes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {data?.total} total records
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline" size="icon"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                const p = i + 1;
                return (
                  <Button
                    key={p}
                    variant={p === page ? 'default' : 'outline'}
                    size="icon"
                    onClick={() => setPage(p)}
                    className="w-8 h-8 text-xs"
                  >
                    {p}
                  </Button>
                );
              })}
              <Button
                variant="outline" size="icon"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
