import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, RotateCcw, ChevronRight, Loader2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import ReturnForm from '../../components/sales/ReturnForm';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(n || 0);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function ReturnDetail({ ret, onClose, onRemoved }) {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canUpdate = hasPermission('SALES_UPDATE');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const removeMutation = useMutation({
    mutationFn: () => api.delete(`/returns/${ret.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['returns'] }); onRemoved(); },
    onError: (err) => setError(err.response?.data?.message || 'Failed to remove return'),
  });

  return (
    <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
      <div>
        <p className="text-xs text-muted-foreground">Return</p>
        <h2 className="text-xl font-bold">{ret.returnNumber}</h2>
        <p className="text-sm text-muted-foreground">{ret.client?.companyName}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Return Date:</span> {fmtDate(ret.returnDate)}</div>
        <div><span className="text-muted-foreground">Created By:</span> {ret.createdByUser?.fullName}</div>
        {ret.sale && <div><span className="text-muted-foreground">From Sale:</span> {ret.sale.saleNumber}</div>}
        {ret.reason && <div><span className="text-muted-foreground">Reason:</span> {ret.reason}</div>}
        {ret.creditNote && (
          <div className="col-span-2 p-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700">
            Credit note issued: {ret.creditNote.reference} — {fmt(ret.creditNote.amount)} on {fmtDate(ret.creditNote.date)}
          </div>
        )}
        {ret.notes && <div className="col-span-2 text-xs"><span className="text-muted-foreground">Notes:</span> {ret.notes}</div>}
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Description</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Qty</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Unit Price</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ret.items?.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-2 text-xs">
                  <div>{item.description}</div>
                  {item.product && <div className="text-muted-foreground">{item.product.sku}</div>}
                </td>
                <td className="px-3 py-2 text-xs text-right">{item.quantity}</td>
                <td className="px-3 py-2 text-xs text-right">{fmt(item.unitPrice)}</td>
                <td className="px-3 py-2 text-xs text-right font-medium">{fmt(item.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/20 border-t font-bold">
            <tr>
              <td colSpan={3} className="px-3 py-2 text-sm text-right">Total</td>
              <td className="px-3 py-2 text-sm text-right">{fmt(ret.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {confirming ? (
        <div className="border rounded-xl p-4 bg-red-50 space-y-3">
          <p className="text-sm font-medium text-red-700">Permanently remove this return?</p>
          <ul className="text-xs text-red-600 space-y-1 list-disc list-inside">
            <li>Reverses the inventory adjustment and deletes the credit note</li>
            <li>This cannot be undone</li>
          </ul>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={() => removeMutation.mutate()} disabled={removeMutation.isPending}>
              {removeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              Yes, Remove
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>Keep</Button>
          </div>
        </div>
      ) : (
        canUpdate && (
          <div className="flex justify-end border-t pt-4">
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => { setError(''); setConfirming(true); }}>
              <XCircle className="w-3.5 h-3.5" /> Remove
            </Button>
          </div>
        )
      )}
    </div>
  );
}

export default function ReturnsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['returns', { search }],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set('search', search);
      return api.get(`/returns?${p}`).then((r) => r.data);
    },
  });

  const { data: detail } = useQuery({
    queryKey: ['return-detail', detailId],
    queryFn: () => api.get(`/returns/${detailId}`).then((r) => r.data),
    enabled: !!detailId,
  });

  const returns = data?.returns || [];
  const total = data?.total || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Return Items</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{total} total</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Return
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by number or client..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Return #</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Client</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">From Sale</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Items</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}>{[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}</tr>
              ))
            ) : returns.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10">
                  <RotateCcw className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No returns found</p>
                </td>
              </tr>
            ) : (
              returns.map((ret) => (
                <tr key={ret.id} className="hover:bg-muted/20 cursor-pointer group" onClick={() => setDetailId(ret.id)}>
                  <td className="px-4 py-3 font-mono text-xs font-medium">{ret.returnNumber}</td>
                  <td className="px-4 py-3 font-medium">{ret.client?.companyName}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{ret.sale?.saleNumber || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{ret._count?.items}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(ret.totalAmount)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(ret.returnDate)}</td>
                  <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl" onClose={() => setShowCreate(false)}>
          <DialogHeader><DialogTitle>New Return</DialogTitle></DialogHeader>
          <ReturnForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['returns'] }); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-2xl" onClose={() => setDetailId(null)}>
          <DialogHeader><DialogTitle>Return Detail</DialogTitle></DialogHeader>
          {detail && <ReturnDetail ret={detail} onClose={() => setDetailId(null)} onRemoved={() => setDetailId(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
