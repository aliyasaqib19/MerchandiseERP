import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck, Plus, ArrowRight, ArrowUpRight, ArrowDownLeft, Trash2, Loader2,
  Check, X, ClipboardCheck, Package, Upload, FileText, Search,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useWarehouseStore } from '../../store/warehouseStore';
import { useAuthStore } from '../../store/authStore';
import { useWarehouseAccess } from '../../hooks/useWarehouseAccess';
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
  const [rows, setRows] = useState([{ productId: '', quantity: '', search: '' }]);
  const [newItemRow, setNewItemRow] = useState(null); // index of row showing the quick-create form
  const [newItemName, setNewItemName] = useState('');
  const [newItemSku, setNewItemSku] = useState('');
  const [newItemError, setNewItemError] = useState('');

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

  const createProductMutation = useMutation({
    mutationFn: ({ rowIndex, ...data }) => api.post('/inventory/products', data).then((r) => r.data),
    onSuccess: (product, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
      updateRow(variables.rowIndex, 'productId', String(product.id));
      updateRow(variables.rowIndex, 'search', product.name);
      setNewItemRow(null);
      setNewItemName('');
      setNewItemSku('');
      setNewItemError('');
    },
    onError: (e) => setNewItemError(e?.response?.data?.message || 'Could not create item'),
  });

  const destOptions = warehouses.filter((w) => w.id !== activeWarehouse?.id);

  const updateRow = (i, key, val) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const addRow = () => setRows((rs) => [...rs, { productId: '', quantity: '', search: '' }]);
  const removeRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  function matchesFor(search) {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }

  function openQuickCreate(i) {
    setNewItemRow(i);
    setNewItemName(rows[i].search);
    setNewItemSku('');
    setNewItemError('');
  }

  function submitQuickCreate(e) {
    e.preventDefault();
    if (!newItemName.trim() || !newItemSku.trim()) { setNewItemError('Name and SKU are both required.'); return; }
    // If it's being shipped, this warehouse must physically have at least
    // that many units — seed the new product's stock with the shipment
    // quantity so the shipment can actually be received later instead of
    // failing with "insufficient stock" against a freshly-created 0 count.
    const shippedQty = Number(rows[newItemRow]?.quantity) || 0;
    createProductMutation.mutate({
      rowIndex: newItemRow,
      sku: newItemSku.trim(), name: newItemName.trim(), unitType: 'PIECE', quantity: shippedQty,
    });
  }

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
              {rows.map((row, i) => {
                const matches = matchesFor(row.search);
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          className="pl-8"
                          placeholder="Search product by name or SKU…"
                          value={row.search}
                          onChange={(e) => { updateRow(i, 'search', e.target.value); updateRow(i, 'productId', ''); }}
                        />
                      </div>
                      <Input type="number" min="1" placeholder="Qty" className="w-24" value={row.quantity} onChange={(e) => updateRow(i, 'quantity', e.target.value)} />
                      <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeRow(i)} disabled={rows.length === 1}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {row.search && !row.productId && (
                      matches.length > 0 ? (
                        <div className="ml-1 border rounded-md divide-y max-h-32 overflow-y-auto">
                          {matches.slice(0, 8).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-muted/50"
                              onClick={() => { updateRow(i, 'productId', String(p.id)); updateRow(i, 'search', p.name); }}
                            >
                              {p.name} <span className="text-muted-foreground">({p.sku} · {p.quantity} {p.unitType} in stock)</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="ml-1 flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">No product matches "{row.search}".</p>
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                            onClick={() => openQuickCreate(i)}
                          >
                            <Plus className="w-3 h-3" /> Create New Item
                          </button>
                        </div>
                      )
                    )}

                    {newItemRow === i && (
                      <div className="ml-1 border rounded-md p-3 space-y-2 bg-muted/30">
                        <p className="text-xs font-medium">New item</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Item name" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} />
                          <Input placeholder="SKU / manufacture no." value={newItemSku} onChange={(e) => setNewItemSku(e.target.value)} />
                        </div>
                        {newItemError && <p className="text-xs text-destructive">{newItemError}</p>}
                        <div className="flex gap-2">
                          <Button type="button" size="sm" onClick={submitQuickCreate} disabled={createProductMutation.isPending}>
                            {createProductMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Create & Select
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => { setNewItemRow(null); setNewItemError(''); }}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
  const [search, setSearch] = useState('');

  const { canEdit } = useWarehouseAccess();
  // Mutating actions require write access to the active warehouse (view-only elsewhere).
  const canCreate  = hasPermission('SHIPMENTS_CREATE') && canEdit;
  const canApprove = hasPermission('SHIPMENTS_APPROVE') && canEdit;
  const canReceive = hasPermission('SHIPMENTS_RECEIVE') && canEdit;

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['shipments'],
    queryFn: () => api.get('/shipments').then((r) => r.data),
  });

  const q = search.trim().toLowerCase();
  const filteredShipments = q
    ? shipments.filter((s) =>
        s.shipmentNumber?.toLowerCase().includes(q) ||
        s.consignmentNumber?.toLowerCase().includes(q) ||
        s.sourceWarehouse?.name?.toLowerCase().includes(q) ||
        s.destWarehouse?.name?.toLowerCase().includes(q)
      )
    : shipments;

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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by shipment #, consignment #, or warehouse..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
            ) : filteredShipments.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-muted-foreground">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  {shipments.length === 0 ? 'No shipments yet.' : 'No shipments match your search.'}
                </td>
              </tr>
            ) : (
              filteredShipments.map((s) => {
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
