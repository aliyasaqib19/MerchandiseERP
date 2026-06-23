import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck, Plus, ArrowRight, ArrowUpRight, ArrowDownLeft, Trash2, Loader2,
  Check, X, ClipboardCheck, Package, Upload, FileText,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useWarehouseStore } from '../../store/warehouseStore';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';

const STATUS_META = {
  IN_PROCESS:       { label: 'In Process',         cls: 'bg-gray-100 text-gray-700' },
  PENDING_APPROVAL: { label: 'Waiting for Approval', cls: 'bg-amber-50 text-amber-700' },
  APPROVED:         { label: 'Approved – add details', cls: 'bg-blue-50 text-blue-700' },
  REJECTED:         { label: 'Rejected',            cls: 'bg-red-50 text-red-700' },
  DELIVERY:         { label: 'Delivery',            cls: 'bg-indigo-50 text-indigo-700' },
  RECEIVED:         { label: 'Received',            cls: 'bg-green-50 text-green-700' },
  DECLINED:         { label: 'Declined',            cls: 'bg-red-50 text-red-700' },
};

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ─── Create Shipment Modal (items + destination only) ─── */
function CreateShipmentModal({ onClose }) {
  const queryClient = useQueryClient();
  const activeWarehouse = useWarehouseStore((s) => s.activeWarehouse);
  const [destWarehouseId, setDestWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState([{ productId: '', quantity: '' }]);

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((r) => r.data),
  });
  const { data: products = [] } = useQuery({
    queryKey: ['inventory-products', 'shipment-picker'],
    queryFn: () => api.get('/inventory/products?status=ACTIVE').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/shipments', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-bell'] });
      onClose();
    },
  });

  const destOptions = warehouses.filter((w) => w.id !== activeWarehouse?.id);

  const updateRow = (i, key, val) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const addRow = () => setRows((rs) => [...rs, { productId: '', quantity: '' }]);
  const removeRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  function submit(e) {
    e.preventDefault();
    const items = rows
      .filter((r) => r.productId && Number(r.quantity) > 0)
      .map((r) => ({ productId: Number(r.productId), quantity: Number(r.quantity) }));
    if (!destWarehouseId || items.length === 0) return;
    createMutation.mutate({ destWarehouseId: Number(destWarehouseId), items, notes });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" onClose={onClose}>
        <DialogHeader><DialogTitle>New Shipment</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Select the items and destination. The Consignment No. & DC are added later, after the Boss approves.</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">From (this warehouse)</label>
              <Input value={activeWarehouse?.name || ''} disabled />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">To (destination) *</label>
              <Select value={destWarehouseId} onChange={(e) => setDestWarehouseId(e.target.value)} required>
                <option value="">Select warehouse…</option>
                {destOptions.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Items</label>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select className="flex-1" value={row.productId} onChange={(e) => updateRow(i, 'productId', e.target.value)}>
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.quantity} {p.unitType} in stock)</option>
                    ))}
                  </Select>
                  <Input type="number" min="1" placeholder="Qty" className="w-24" value={row.quantity} onChange={(e) => updateRow(i, 'quantity', e.target.value)} />
                  <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeRow(i)} disabled={rows.length === 1}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addRow}>
              <Plus className="w-3.5 h-3.5" /> Add Item
            </Button>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" />
          </div>

          {createMutation.isError && (
            <p className="text-sm text-red-600">{createMutation.error?.response?.data?.message || 'Failed to create shipment'}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Continue — Send for Approval
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Add Shipment Details Modal (consignment + DC) ─── */
function DetailsModal({ shipment, onClose }) {
  const queryClient = useQueryClient();
  const [consignmentNumber, setConsignmentNumber] = useState('');
  const [challan, setChallan] = useState(null);
  const [challanError, setChallanError] = useState('');

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/shipments/${shipment.id}/details`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-bell'] });
      onClose();
    },
    onError: (e) => setChallanError(e?.response?.data?.message || 'Failed to save details'),
  });

  function onChallanChange(e) {
    const file = e.target.files?.[0];
    setChallanError('');
    if (!file) { setChallan(null); return; }
    if (file.size > 10 * 1024 * 1024) { setChallanError('File must be under 10 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setChallan({ url: reader.result, name: file.name });
    reader.readAsDataURL(file);
  }

  function submit(e) {
    e.preventDefault();
    if (!consignmentNumber.trim()) return;
    if (!challan) { setChallanError('Delivery challan (DC) is required.'); return; }
    mutation.mutate({ consignmentNumber: consignmentNumber.trim(), challanUrl: challan.url, challanName: challan.name });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent onClose={onClose}>
        <DialogHeader><DialogTitle>Shipment Details — {shipment.shipmentNumber}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Add the Consignment Number and upload the DC to dispatch to {shipment.destWarehouse?.name}.</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Consignment Number *</label>
            <Input value={consignmentNumber} onChange={(e) => setConsignmentNumber(e.target.value)} required placeholder="e.g. CN-2026-0001" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Delivery Challan (DC) *</label>
            <label className="flex items-center gap-2 border border-dashed rounded-lg px-3 py-3 cursor-pointer hover:bg-muted/40 transition-colors">
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{challan ? challan.name : 'Click to upload DC (PDF or image, max 10 MB)'}</span>
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onChallanChange} />
            </label>
            {challan && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><FileText className="w-3 h-3" /> {challan.name} attached</p>}
            {challanError && <p className="text-xs text-red-600 mt-1">{challanError}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Continue — Dispatch
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Page ─── */
export default function ShipmentsPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [showCreate, setShowCreate] = useState(false);
  const [detailsFor, setDetailsFor] = useState(null);

  const canCreate  = hasPermission('SHIPMENTS_CREATE');
  const canApprove = hasPermission('SHIPMENTS_APPROVE');
  const canReceive = hasPermission('SHIPMENTS_RECEIVE');

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['shipments'],
    queryFn: () => api.get('/shipments').then((r) => r.data),
  });

  const action = useMutation({
    mutationFn: ({ id, verb }) => api.post(`/shipments/${id}/${verb}`).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-bell'] });
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: (e) => alert(e?.response?.data?.message || 'Action failed'),
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/shipments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shipments'] }),
    onError: (e) => alert(e?.response?.data?.message || 'Delete failed'),
  });

  function renderActions(s) {
    const busy = action.isPending || del.isPending;

    if (s.status === 'PENDING_APPROVAL') {
      if (canApprove) {
        return (
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={busy} onClick={() => action.mutate({ id: s.id, verb: 'approve' })}>
              <Check className="w-3.5 h-3.5" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled={busy} onClick={() => action.mutate({ id: s.id, verb: 'reject' })}>
              <X className="w-3.5 h-3.5" /> Reject
            </Button>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2 justify-end">
          <span className="text-xs text-muted-foreground">Waiting for Boss approval</span>
          {canCreate && s.direction === 'OUTGOING' && (
            <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => del.mutate(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
          )}
        </div>
      );
    }

    if (s.status === 'APPROVED') {
      if (canCreate && s.direction === 'OUTGOING') {
        return (
          <Button size="sm" disabled={busy} onClick={() => setDetailsFor(s)}>
            <FileText className="w-3.5 h-3.5" /> Add Shipment Details
          </Button>
        );
      }
      return <span className="text-xs text-muted-foreground">Approved — awaiting details</span>;
    }

    if (s.status === 'DELIVERY') {
      if (canReceive && s.direction === 'INCOMING') {
        return (
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" disabled={busy} onClick={() => action.mutate({ id: s.id, verb: 'receive' })}>
              <ClipboardCheck className="w-3.5 h-3.5" /> Receive / Confirm
            </Button>
            <Button size="sm" variant="outline" className="text-destructive" disabled={busy} onClick={() => action.mutate({ id: s.id, verb: 'decline' })}>
              <X className="w-3.5 h-3.5" /> Decline
            </Button>
          </div>
        );
      }
      return <span className="text-xs text-muted-foreground">In delivery</span>;
    }

    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Truck className="w-6 h-6" /> Shipments</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Create → Approval → Shipment Details → Delivery → Receive</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> New Shipment
          </Button>
        )}
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Shipment #</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Consignment #</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Direction</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Route</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">DC</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Items</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}>{[...Array(9)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>)}</tr>
              ))
            ) : shipments.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  No shipments yet.
                </td>
              </tr>
            ) : (
              shipments.map((s) => {
                const meta = STATUS_META[s.status] || {};
                return (
                  <tr key={s.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{s.shipmentNumber}</td>
                    <td className="px-4 py-3 font-mono text-xs">{s.consignmentNumber || '—'}</td>
                    <td className="px-4 py-3">
                      {s.direction === 'OUTGOING' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-orange-600"><ArrowUpRight className="w-3.5 h-3.5" /> Outgoing</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600"><ArrowDownLeft className="w-3.5 h-3.5" /> Incoming</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        {s.sourceWarehouse?.name}<ArrowRight className="w-3 h-3 text-muted-foreground" />{s.destWarehouse?.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {s.challanUrl ? (
                        <a href={s.challanUrl} target="_blank" rel="noreferrer" download={s.challanName || 'challan'} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <FileText className="w-3.5 h-3.5" /> View
                        </a>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">{s._count?.items ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(s.createdAt)}</td>
                    <td className="px-4 py-3">{renderActions(s)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateShipmentModal onClose={() => setShowCreate(false)} />}
      {detailsFor && <DetailsModal shipment={detailsFor} onClose={() => setDetailsFor(null)} />}
    </div>
  );
}
