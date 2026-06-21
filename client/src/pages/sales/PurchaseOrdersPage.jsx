import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, ShoppingCart, ChevronRight, CheckCircle2, XCircle,
  Loader2, Edit2, Trash2, RefreshCw,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { SalesStatusBadge } from '../../components/sales/SalesStatusBadge';
import POForm from '../../components/sales/POForm';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(n || 0);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function PODetail({ po, onClose, onRefresh }) {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canApprove = hasPermission('SALES_APPROVE');
  const canCreate  = hasPermission('SALES_CREATE');

  const statusMutation = useMutation({
    mutationFn: (status) => api.patch(`/purchase-orders/${po.id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchase-orders'] }); onRefresh(); },
  });

  const convertMutation = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${po.id}/convert`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
      onClose();
    },
  });

  return (
    <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Purchase Order</p>
          <h2 className="text-xl font-bold">{po.poNumber}</h2>
          <p className="text-sm text-muted-foreground">{po.client?.companyName}</p>
          {po.quotation && (
            <p className="text-xs text-muted-foreground mt-0.5">Ref: {po.quotation.quotationNumber}</p>
          )}
        </div>
        <SalesStatusBadge status={po.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">PO Date:</span> {fmtDate(po.poDate)}</div>
        <div><span className="text-muted-foreground">Expected Delivery:</span> {fmtDate(po.expectedDelivery)}</div>
        <div><span className="text-muted-foreground">Created By:</span> {po.createdByUser?.fullName}</div>
        {po.notes && <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> {po.notes}</div>}
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
            {po.items?.map((item) => (
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
              <td className="px-3 py-2 text-sm text-right">{fmt(po.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        {po.status === 'PENDING' && canApprove && (
          <>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => statusMutation.mutate('APPROVED')} disabled={statusMutation.isPending}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="text-red-600" onClick={() => statusMutation.mutate('REJECTED')} disabled={statusMutation.isPending}>
              <XCircle className="w-3.5 h-3.5" /> Reject
            </Button>
          </>
        )}
        {po.status === 'APPROVED' && canCreate && (
          <Button size="sm" onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending}>
            {convertMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Convert to Sale
          </Button>
        )}
        {['PENDING', 'APPROVED'].includes(po.status) && canApprove && (
          <Button size="sm" variant="outline" className="text-muted-foreground ml-auto" onClick={() => statusMutation.mutate('CANCELLED')} disabled={statusMutation.isPending}>
            Cancel PO
          </Button>
        )}
      </div>
    </div>
  );
}

export default function PurchaseOrdersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId]     = useState(null);
  const [editingId, setEditingId]   = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', { search, status }],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set('search', search);
      if (status) p.set('status', status);
      return api.get(`/purchase-orders?${p}`).then((r) => r.data);
    },
  });

  const { data: detail, refetch: refetchDetail } = useQuery({
    queryKey: ['po-detail', detailId],
    queryFn: () => api.get(`/purchase-orders/${detailId}`).then((r) => r.data),
    enabled: !!detailId,
  });

  const { data: editingData } = useQuery({
    queryKey: ['po-detail', editingId],
    queryFn: () => api.get(`/purchase-orders/${editingId}`).then((r) => r.data),
    enabled: !!editingId,
  });

  const pos = data?.purchaseOrders || [];
  const total = data?.total || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{total} total</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New PO
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by number or client..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">PO #</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Client</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Quotation</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Items</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">PO Date</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}>{[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}</tr>
              ))
            ) : pos.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10">
                  <ShoppingCart className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No purchase orders found</p>
                </td>
              </tr>
            ) : (
              pos.map((po) => (
                <tr key={po.id} className="hover:bg-muted/20 cursor-pointer group" onClick={() => setDetailId(po.id)}>
                  <td className="px-4 py-3 font-mono text-xs font-medium">{po.poNumber}</td>
                  <td className="px-4 py-3 font-medium">{po.client?.companyName}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{po.quotation?.quotationNumber || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{po._count?.items}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(po.totalAmount)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(po.poDate)}</td>
                  <td className="px-4 py-3"><SalesStatusBadge status={po.status} /></td>
                  <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl" onClose={() => setShowCreate(false)}>
          <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
          <POForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['purchase-orders'] }); }} />
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailId && !editingId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-2xl" onClose={() => setDetailId(null)}>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              PO Detail
              {detail?.status === 'PENDING' && (
                <Button size="sm" variant="outline" onClick={() => setEditingId(detailId)}>
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {detail && <PODetail po={detail} onClose={() => setDetailId(null)} onRefresh={() => refetchDetail()} />}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="max-w-3xl" onClose={() => setEditingId(null)}>
          <DialogHeader><DialogTitle>Edit Purchase Order</DialogTitle></DialogHeader>
          {editingData && (
            <POForm
              poId={editingId}
              defaultValues={editingData}
              onSuccess={() => {
                setEditingId(null);
                qc.invalidateQueries({ queryKey: ['purchase-orders'] });
                refetchDetail();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
