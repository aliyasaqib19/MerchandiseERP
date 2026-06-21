import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, FileText, ChevronRight, Eye, Send, CheckCircle2,
  XCircle, Loader2, Edit2, Trash2, RefreshCw,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { SalesStatusBadge } from '../../components/sales/SalesStatusBadge';
import QuotationForm from '../../components/sales/QuotationForm';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(n || 0);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function QuotationDetail({ quotation, onClose, onRefresh }) {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canApprove = hasPermission('SALES_APPROVE');
  const canCreate  = hasPermission('SALES_CREATE');

  const statusMutation = useMutation({
    mutationFn: (status) => api.patch(`/quotations/${quotation.id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotations'] }); onRefresh(); },
  });

  const convertMutation = useMutation({
    mutationFn: () => api.post(`/quotations/${quotation.id}/convert`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/quotations/${quotation.id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quotations'] }); onClose(); },
  });

  const q = quotation;

  return (
    <div className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Quotation</p>
          <h2 className="text-xl font-bold">{q.quotationNumber}</h2>
          <p className="text-sm text-muted-foreground">{q.client?.companyName}</p>
        </div>
        <div className="flex items-center gap-2">
          <SalesStatusBadge status={q.status} />
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Date:</span> {fmtDate(q.createdAt)}</div>
        <div><span className="text-muted-foreground">Valid Until:</span> {fmtDate(q.validUntil)}</div>
        <div><span className="text-muted-foreground">Created By:</span> {q.createdByUser?.fullName}</div>
        {q.terms && <div className="col-span-2"><span className="text-muted-foreground">Terms:</span> {q.terms}</div>}
        {q.notes && <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> {q.notes}</div>}
      </div>

      {/* Items */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Description</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Qty</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Unit Price</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Disc %</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {q.items?.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-2 text-xs">
                  <div>{item.description}</div>
                  {item.product && <div className="text-muted-foreground">{item.product.sku}</div>}
                </td>
                <td className="px-3 py-2 text-xs text-right">{item.quantity}</td>
                <td className="px-3 py-2 text-xs text-right">{fmt(item.unitPrice)}</td>
                <td className="px-3 py-2 text-xs text-right">{item.discount > 0 ? `${item.discount}%` : '—'}</td>
                <td className="px-3 py-2 text-xs text-right font-medium">{fmt(item.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-muted/20 border-t">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-xs text-right text-muted-foreground">Subtotal</td>
              <td className="px-3 py-2 text-xs text-right font-medium">{fmt(q.subtotal)}</td>
            </tr>
            {q.discountAmount > 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-2 text-xs text-right text-red-600">Discount</td>
                <td className="px-3 py-2 text-xs text-right text-red-600">- {fmt(q.discountAmount)}</td>
              </tr>
            )}
            {q.taxAmount > 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-2 text-xs text-right text-muted-foreground">Tax ({q.taxRate}%)</td>
                <td className="px-3 py-2 text-xs text-right">{fmt(q.taxAmount)}</td>
              </tr>
            )}
            <tr className="font-bold">
              <td colSpan={4} className="px-3 py-2 text-sm text-right">Total</td>
              <td className="px-3 py-2 text-sm text-right">{fmt(q.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        {q.status === 'DRAFT' && canApprove && (
          <Button size="sm" variant="outline" onClick={() => statusMutation.mutate('SENT')} disabled={statusMutation.isPending}>
            {statusMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Mark Sent
          </Button>
        )}
        {q.status === 'SENT' && canApprove && (
          <>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => statusMutation.mutate('APPROVED')} disabled={statusMutation.isPending}>
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="text-red-600" onClick={() => statusMutation.mutate('REJECTED')} disabled={statusMutation.isPending}>
              <XCircle className="w-3.5 h-3.5" /> Reject
            </Button>
          </>
        )}
        {q.status === 'APPROVED' && canCreate && (
          <Button size="sm" onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending}>
            {convertMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Convert to Sale
          </Button>
        )}
        {q.status === 'DRAFT' && (
          <Button
            size="sm" variant="outline" className="text-destructive ml-auto"
            onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

export default function QuotationsPage() {
  const qc = useQueryClient();
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId]     = useState(null);
  const [editingId, setEditingId]   = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', { search, status }],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set('search', search);
      if (status) p.set('status', status);
      return api.get(`/quotations?${p}`).then((r) => r.data);
    },
  });

  const { data: detail, refetch: refetchDetail } = useQuery({
    queryKey: ['quotation-detail', detailId],
    queryFn: () => api.get(`/quotations/${detailId}`).then((r) => r.data),
    enabled: !!detailId,
  });

  const { data: editingData } = useQuery({
    queryKey: ['quotation-detail', editingId],
    queryFn: () => api.get(`/quotations/${editingId}`).then((r) => r.data),
    enabled: !!editingId,
  });

  const quotations = data?.quotations || [];
  const total      = data?.total || 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quotations</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{total} total</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Quotation
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by number or client..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="SENT">Sent</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="EXPIRED">Expired</option>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">#</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Client</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Items</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Valid Until</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}</tr>
              ))
            ) : quotations.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No quotations found</p>
                </td>
              </tr>
            ) : (
              quotations.map((q) => (
                <tr key={q.id} className="hover:bg-muted/20 transition-colors group cursor-pointer" onClick={() => setDetailId(q.id)}>
                  <td className="px-4 py-3 font-mono text-xs font-medium">{q.quotationNumber}</td>
                  <td className="px-4 py-3 font-medium">{q.client?.companyName}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{q._count?.items} item(s)</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(q.totalAmount)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(q.validUntil)}</td>
                  <td className="px-4 py-3"><SalesStatusBadge status={q.status} /></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(q.createdAt)}</td>
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl" onClose={() => setShowCreate(false)}>
          <DialogHeader><DialogTitle>New Quotation</DialogTitle></DialogHeader>
          <QuotationForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['quotations'] }); }} />
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailId && !editingId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-2xl" onClose={() => setDetailId(null)}>
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-8">
              Quotation Detail
              {detail?.status === 'DRAFT' && (
                <Button size="sm" variant="outline" onClick={() => setEditingId(detailId)}>
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <QuotationDetail
              quotation={detail}
              onClose={() => setDetailId(null)}
              onRefresh={() => refetchDetail()}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent className="max-w-3xl" onClose={() => setEditingId(null)}>
          <DialogHeader><DialogTitle>Edit Quotation</DialogTitle></DialogHeader>
          {editingData && (
            <QuotationForm
              quotationId={editingId}
              defaultValues={editingData}
              onSuccess={() => {
                setEditingId(null);
                qc.invalidateQueries({ queryKey: ['quotations'] });
                qc.invalidateQueries({ queryKey: ['quotation-detail', editingId] });
                refetchDetail();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
