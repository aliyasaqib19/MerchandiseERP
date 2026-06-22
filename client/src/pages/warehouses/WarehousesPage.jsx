import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Warehouse, Plus, MapPin, Phone, User, Package, ArrowLeftRight,
  MoreHorizontal, Pencil, Trash2, CheckCircle2, XCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import api from '../../lib/api';

function StatusBadge({ status }) {
  return status === 'ACTIVE' ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="w-3 h-3" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
      <XCircle className="w-3 h-3" /> Inactive
    </span>
  );
}

function WarehouseFormModal({ warehouse, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = !!warehouse?.id;
  const [form, setForm] = useState({
    name: warehouse?.name || '',
    city: warehouse?.city || '',
    address: warehouse?.address || '',
    contactPerson: warehouse?.contactPerson || '',
    phone: warehouse?.phone || '',
    capacity: warehouse?.capacity || '',
    notes: warehouse?.notes || '',
    status: warehouse?.status || 'ACTIVE',
  });

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? api.put(`/warehouses/${warehouse.id}`, data).then((r) => r.data)
        : api.post('/warehouses', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      onClose();
    },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? 'Edit Warehouse' : 'Add Warehouse'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }}
          className="p-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">Warehouse Name *</label>
              <Input value={form.name} onChange={set('name')} required placeholder="e.g. Karachi Warehouse" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">City</label>
              <Input value={form.city} onChange={set('city')} placeholder="Karachi" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Phone</label>
              <Input value={form.phone} onChange={set('phone')} placeholder="+92 21 ..." />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">Address</label>
              <Input value={form.address} onChange={set('address')} placeholder="Plot 45, Industrial Area..." />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Contact Person</label>
              <Input value={form.contactPerson} onChange={set('contactPerson')} placeholder="Manager name" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Capacity (units)</label>
              <Input type="number" value={form.capacity} onChange={set('capacity')} placeholder="5000" />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">Notes</label>
              <Input value={form.notes} onChange={set('notes')} placeholder="Optional notes..." />
            </div>
            {isEdit && (
              <div>
                <label className="text-sm font-medium mb-1 block">Status</label>
                <select
                  value={form.status}
                  onChange={set('status')}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            )}
          </div>
          {mutation.isError && (
            <p className="text-sm text-red-600">{mutation.error?.response?.data?.message || 'Failed to save warehouse'}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Warehouse'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function WarehousesPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null); // null | { mode: 'add' } | { mode: 'edit', warehouse }

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/warehouses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['warehouses'] }),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Warehouses</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {warehouses.length} warehouse{warehouses.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Button onClick={() => setModal({ mode: 'add' })}>
          <Plus className="w-4 h-4" /> Add Warehouse
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border rounded-2xl p-5 space-y-3 animate-pulse">
              <div className="h-5 bg-muted rounded w-40" />
              <div className="h-4 bg-muted rounded w-32" />
            </div>
          ))}
        </div>
      ) : warehouses.length === 0 ? (
        <div className="text-center py-20 border rounded-2xl">
          <Warehouse className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium text-lg">No warehouses yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add your first warehouse to get started</p>
          <Button className="mt-4" onClick={() => setModal({ mode: 'add' })}>
            <Plus className="w-4 h-4" /> Add Warehouse
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {warehouses.map((wh) => (
            <div key={wh.id} className="group border rounded-2xl p-5 bg-white hover:shadow-md transition-all space-y-4">
              {/* Top row */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Warehouse className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <Link
                      to={`/warehouses/${wh.id}`}
                      className="font-semibold text-base hover:text-primary hover:underline leading-tight"
                    >
                      {wh.name}
                    </Link>
                    <StatusBadge status={wh.status} />
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setModal({ mode: 'edit', warehouse: wh })}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete "${wh.name}"? Products will be unassigned.`)) {
                        deleteMutation.mutate(wh.id);
                      }
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="space-y-1.5 text-sm text-muted-foreground">
                {wh.city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{wh.city}{wh.address ? ` — ${wh.address}` : ''}</span>
                  </div>
                )}
                {wh.contactPerson && (
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{wh.contactPerson}</span>
                  </div>
                )}
                {wh.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{wh.phone}</span>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="flex gap-3 pt-1 border-t">
                <div className="flex items-center gap-1.5 text-sm">
                  <Package className="w-4 h-4 text-primary/70" />
                  <span className="font-semibold">{wh._count?.products ?? 0}</span>
                  <span className="text-muted-foreground">products</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <ArrowLeftRight className="w-4 h-4 text-primary/70" />
                  <span className="font-semibold">{wh._count?.transactions ?? 0}</span>
                  <span className="text-muted-foreground">movements</span>
                </div>
                {wh.capacity && (
                  <div className="ml-auto text-xs text-muted-foreground">
                    Cap: {wh.capacity.toLocaleString()}
                  </div>
                )}
              </div>

              {/* View button */}
              <Link
                to={`/warehouses/${wh.id}`}
                className="block text-center text-sm text-primary font-medium hover:underline pt-1"
              >
                Open Warehouse →
              </Link>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <WarehouseFormModal
          warehouse={modal.mode === 'edit' ? modal.warehouse : null}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
