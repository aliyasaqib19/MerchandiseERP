import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, PackageCheck, CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import DemoForm from '../../components/sales/DemoForm';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function StatusBadge({ status }) {
  const isOut = status === 'OUT';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      isOut ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
    }`}>
      {isOut ? 'Out' : 'Returned'}
    </span>
  );
}

export default function DemoItemsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canUpdate = hasPermission('SALES_UPDATE');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['demo-items', { search, status }],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set('search', search);
      if (status) p.set('status', status);
      return api.get(`/demo-items?${p}`).then((r) => r.data);
    },
  });

  const returnMutation = useMutation({
    mutationFn: (id) => api.patch(`/demo-items/${id}/return`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['demo-items'] }),
    onError: (err) => setError(err.response?.data?.message || 'Failed to mark returned'),
  });

  const removeMutation = useMutation({
    mutationFn: (id) => api.delete(`/demo-items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['demo-items'] }),
    onError: (err) => setError(err.response?.data?.message || 'Failed to remove'),
  });

  const demos = data?.demos || [];
  const total = data?.total || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Demo Items</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{total} total</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Demo
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by number or client..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="">All Status</option>
          <option value="OUT">Out</option>
          <option value="RETURNED">Returned</option>
        </Select>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Demo #</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Client</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Product</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Qty</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date Out</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Expected Return</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}>{[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}</tr>
              ))
            ) : demos.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10">
                  <PackageCheck className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No demo items found</p>
                </td>
              </tr>
            ) : (
              demos.map((demo) => (
                <tr key={demo.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs font-medium">{demo.demoNumber}</td>
                  <td className="px-4 py-3 font-medium">{demo.client?.companyName}</td>
                  <td className="px-4 py-3 text-xs">
                    <div>{demo.product?.name}</div>
                    <div className="text-muted-foreground">{demo.product?.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-right">{demo.quantity}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(demo.dateOut)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(demo.expectedReturnDate)}</td>
                  <td className="px-4 py-3"><StatusBadge status={demo.status} /></td>
                  <td className="px-4 py-3">
                    {canUpdate && (
                      <div className="flex justify-end gap-1">
                        {demo.status === 'OUT' && (
                          <Button size="sm" variant="outline" onClick={() => { setError(''); returnMutation.mutate(demo.id); }} disabled={returnMutation.isPending}>
                            {returnMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Mark Returned
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => { setError(''); removeMutation.mutate(demo.id); }} disabled={removeMutation.isPending}>
                          <XCircle className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl" onClose={() => setShowCreate(false)}>
          <DialogHeader><DialogTitle>New Demo Item</DialogTitle></DialogHeader>
          <DemoForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['demo-items'] }); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
