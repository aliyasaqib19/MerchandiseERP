import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Package, ChevronRight, CheckCircle2,
  Truck, XCircle, Loader2, Edit2, AlertTriangle,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { SalesStatusBadge } from '../../components/sales/SalesStatusBadge';
import SaleForm from '../../components/sales/SaleForm';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(n || 0);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SaleDetail({ sale, onClose, onRefresh }) {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canApprove = hasPermission('SALES_APPROVE');
  const canUpdate  = hasPermission('SALES_UPDATE');
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionError, setActionError] = useState('');

  const confirmMutation = useMutation({
    mutationFn: () => api.patch(`/sales/${sale.id}/confirm`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); setConfirmAction(null); onRefresh(); },
    onError: (err) => setActionError(err.response?.data?.message || 'Failed to confirm'),
  });

  const deliverMutation = useMutation({
    mutationFn: () => api.patch(`/sales/${sale.id}/deliver`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); onRefresh(); },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.patch(`/sales/${sale.id}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); setConfirmAction(null); onRefresh(); },
    onError: (err) => setActionError(err.response?.data?.message || 'Failed to cancel'),
  });

  const s = sale;

  return (
    <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Sale Order</p>
          <h2 className="text-xl font-bold">{s.saleNumber}</h2>
          <p className="text-sm text-muted-foreground">{s.client?.companyName}</p>
          <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
            {s.quotation && <span>Quotation: {s.quotation.quotationNumber}</span>}
            {s.purchaseOrder && <span>PO: {s.purchaseOrder.poNumber}</span>}
          </div>
        </div>
        <SalesStatusBadge status={s.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Sale Date:</span> {fmtDate(s.saleDate)}</div>
        <div><span className="text-muted-foreground">Created By:</span> {s.createdByUser?.fullName}</div>
        {s.invoice && (
          <div className="col-span-2 p-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700">
            Invoice generated: {s.invoice.reference} — {fmt(s.invoice.amount)} on {fmtDate(s.invoice.date)}
          </div>
        )}
        {s.notes && <div className="col-span-2 text-xs"><span className="text-muted-foreground">Notes:</span> {s.notes}</div>}
      </div>

      {/* Items with stock info */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Description</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Qty</th>
              {s.status === 'DRAFT' && <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">In Stock</th>}
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Unit Price</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Disc %</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {s.items?.map((item) => {
              const stockOk = !item.product || item.product.quantity >= item.quantity;
              return (
                <tr key={item.id} className={s.status === 'DRAFT' && !stockOk ? 'bg-red-50' : ''}>
                  <td className="px-3 py-2 text-xs">
                    <div>{item.description}</div>
                    {item.product && <div className="text-muted-foreground">{item.product.sku}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs text-right">{item.quantity}</td>
                  {s.status === 'DRAFT' && (
                    <td className={`px-3 py-2 text-xs text-right ${stockOk ? 'text-green-600' : 'text-red-600 font-medium'}`}>
                      {item.product ? item.product.quantity : '—'}
                      {!stockOk && ' ⚠'}
                    </td>
                  )}
                  <td className="px-3 py-2 text-xs text-right">{fmt(item.unitPrice)}</td>
                  <td className="px-3 py-2 text-xs text-right">{item.discount > 0 ? `${item.discount}%` : '—'}</td>
                  <td className="px-3 py-2 text-xs text-right font-medium">{fmt(item.total)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/20 border-t">
            <tr>
              <td colSpan={s.status === 'DRAFT' ? 5 : 4} className="px-3 py-2 text-xs text-right text-muted-foreground">Subtotal</td>
              <td className="px-3 py-2 text-xs text-right font-medium">{fmt(s.subtotal)}</td>
            </tr>
            {s.discountAmount > 0 && (
              <tr>
                <td colSpan={s.status === 'DRAFT' ? 5 : 4} className="px-3 py-2 text-xs text-right text-red-600">Discount</td>
                <td className="px-3 py-2 text-xs text-right text-red-600">- {fmt(s.discountAmount)}</td>
              </tr>
            )}
            {s.taxAmount > 0 && (
              <tr>
                <td colSpan={s.status === 'DRAFT' ? 5 : 4} className="px-3 py-2 text-xs text-right text-muted-foreground">Tax ({s.taxRate}%)</td>
                <td className="px-3 py-2 text-xs text-right">{fmt(s.taxAmount)}</td>
              </tr>
            )}
            <tr className="font-bold">
              <td colSpan={s.status === 'DRAFT' ? 5 : 4} className="px-3 py-2 text-sm text-right">Total</td>
              <td className="px-3 py-2 text-sm text-right">{fmt(s.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {actionError && (
        <div className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {actionError}
        </div>
      )}

      {/* Confirm / Cancel confirmation modal-in-modal */}
      {confirmAction === 'confirm' && (
        <div className="border rounded-xl p-4 bg-indigo-50 space-y-3">
          <p className="text-sm font-medium text-indigo-700">
            Confirm this sale? This will:
          </p>
          <ul className="text-xs text-indigo-600 space-y-1 list-disc list-inside">
            <li>Deduct inventory for all product items</li>
            <li>Generate an invoice and update the client's balance</li>
            <li>Lock the sale (cannot edit after this)</li>
          </ul>
          <div className="flex gap-2">
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
              {confirmMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Yes, Confirm Sale
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setConfirmAction(null); setActionError(''); }}>Cancel</Button>
          </div>
        </div>
      )}

      {confirmAction === 'cancel' && (
        <div className="border rounded-xl p-4 bg-red-50 space-y-3">
          <p className="text-sm font-medium text-red-700">Cancel this sale?</p>
          {s.status === 'CONFIRMED' && (
            <p className="text-xs text-red-600">Inventory will be restored and a credit note will be issued to the client.</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
              {cancelMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              Yes, Cancel
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmAction(null)}>Keep</Button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!confirmAction && (
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {s.status === 'DRAFT' && canApprove && (
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => { setActionError(''); setConfirmAction('confirm'); }}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Confirm Sale
            </Button>
          )}
          {s.status === 'CONFIRMED' && canUpdate && (
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => deliverMutation.mutate()} disabled={deliverMutation.isPending}>
              {deliverMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
              Mark Delivered
            </Button>
          )}
          {['DRAFT', 'CONFIRMED'].includes(s.status) && canApprove && (
            <Button size="sm" variant="outline" className="text-destructive ml-auto" onClick={() => { setActionError(''); setConfirmAction('cancel'); }}>
              <XCircle className="w-3.5 h-3.5" /> Cancel Sale
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SalesOrdersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId]     = useState(null);
  const [editingId, setEditingId]   = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['sales', { search, status }],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set('search', search);
      if (status) p.set('status', status);
      return api.get(`/sales?${p}`).then((r) => r.data);
    },
  });

  const { data: detail, refetch: refetchDetail } = useQuery({
    queryKey: ['sale-detail', detailId],
    queryFn: () => api.get(`/sales/${detailId}`).then((r) => r.data),
    enabled: !!detailId,
  });

  const { data: editingData } = useQuery({
    queryKey: ['sale-detail', editingId],
    queryFn: () => api.get(`/sales/${editingId}`).then((r) => r.data),
    enabled: !!editingId,
  });

  const sales = data?.sales || [];
  const total = data?.total || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales Orders</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{total} total</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Sale
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by number or client..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Sale #</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Client</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Quotation</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">PO</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Items</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(9)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}</tr>
              ))
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-10">
                  <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No sales orders found</p>
                </td>
              </tr>
            ) : (
              sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-muted/20 cursor-pointer group" onClick={() => setDetailId(sale.id)}>
                  <td className="px-4 py-3 font-mono text-xs font-medium">{sale.saleNumber}</td>
                  <td className="px-4 py-3 font-medium">{sale.client?.companyName}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{sale.quotation?.quotationNumber || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{sale.purchaseOrder?.poNumber || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{sale._count?.items}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(sale.totalAmount)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(sale.saleDate)}</td>
                  <td className="px-4 py-3"><SalesStatusBadge status={sale.status} /></td>
                  <td className="px-4 py-3"><ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl" onClose={() => setShowCreate(false)}>
          <DialogHeader><DialogTitle>New Sale Order</DialogTitle></DialogHeader>
          <SaleForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['sales'] }); }} />
        </DialogContent>
      </Dialog>

      {/* Detail */}
      <Dialog open={!!detailId && !editingId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-2xl" onClose={() => setDetailId(null)}>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              Sale Detail
              {detail?.status === 'DRAFT' && (
                <Button size="sm" variant="outline" onClick={() => setEditingId(detailId)}>
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {detail && <SaleDetail sale={detail} onClose={() => setDetailId(null)} onRefresh={() => { refetchDetail(); qc.invalidateQueries({ queryKey: ['sales'] }); }} />}
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="max-w-3xl" onClose={() => setEditingId(null)}>
          <DialogHeader><DialogTitle>Edit Sale Order</DialogTitle></DialogHeader>
          {editingData && (
            <SaleForm
              saleId={editingId}
              defaultValues={editingData}
              onSuccess={() => {
                setEditingId(null);
                qc.invalidateQueries({ queryKey: ['sales'] });
                refetchDetail();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
