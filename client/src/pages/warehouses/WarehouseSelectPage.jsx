import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Warehouse, Plus, MapPin, Phone, User, Package, ArrowRight, LogOut, Pencil, Trash2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuthStore } from '../../store/authStore';
import { useWarehouseStore } from '../../store/warehouseStore';
import api from '../../lib/api';

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
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">Warehouse Name *</label>
              <Input value={form.name} onChange={set('name')} required placeholder="e.g. Islamabad Warehouse" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">City</label>
              <Input value={form.city} onChange={set('city')} placeholder="Islamabad" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Phone</label>
              <Input value={form.phone} onChange={set('phone')} placeholder="+92 51 ..." />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">Address</label>
              <Input value={form.address} onChange={set('address')} placeholder="Plot, Industrial Area..." />
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
                <select value={form.status} onChange={set('status')} className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
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

export default function WarehouseSelectPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, accessToken, logout } = useAuthStore();
  const setActiveWarehouse = useWarehouseStore((s) => s.setActiveWarehouse);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [modal, setModal] = useState(null);

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => api.get('/warehouses').then((r) => r.data),
    enabled: !!accessToken,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/warehouses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['warehouses'] }),
  });

  if (!accessToken || !user) return <Navigate to="/login" replace />;

  const canManage = hasPermission('INVENTORY_CREATE');

  function selectWarehouse(wh) {
    setActiveWarehouse(wh);
    // Fresh data for the new workspace
    queryClient.clear();
    navigate('/dashboard');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center overflow-hidden p-0.5">
              <img src="/aljibra-logo.png" alt="Aljibra" className="w-full h-full object-contain" onError={(e)=>{e.target.style.display='none';}} />
            </div>
            <span className="text-lg font-bold tracking-tight">Aljibra Technologies</span>
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-2 text-sm text-slate-300 hover:text-white"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-12">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Select a Warehouse</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back, {user.fullName}. Choose a warehouse to manage its workspace.
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setModal({ mode: 'add' })}>
              <Plus className="w-4 h-4" /> Add Warehouse
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="border rounded-2xl p-6 bg-white h-44 animate-pulse" />
            ))}
          </div>
        ) : warehouses.length === 0 ? (
          <div className="text-center py-20 border rounded-2xl bg-white">
            <Warehouse className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium text-lg">No warehouses yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first warehouse to get started</p>
            {canManage && (
              <Button className="mt-4" onClick={() => setModal({ mode: 'add' })}>
                <Plus className="w-4 h-4" /> Add Warehouse
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {warehouses.map((wh) => (
              <div
                key={wh.id}
                className="group border rounded-2xl p-6 bg-white hover:shadow-lg hover:border-primary/40 transition-all cursor-pointer relative"
                onClick={() => selectWarehouse(wh)}
              >
                {canManage && (
                  <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setModal({ mode: 'edit', warehouse: wh }); }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete "${wh.name}"? Its records will be unassigned.`)) deleteMutation.mutate(wh.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Warehouse className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">{wh.name}</h3>
                <div className="space-y-1 mt-2 text-sm text-muted-foreground">
                  {wh.city && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{wh.city}</div>}
                  {wh.contactPerson && <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" />{wh.contactPerson}</div>}
                  {wh.phone && <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{wh.phone}</div>}
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{wh._count?.products ?? 0}</span> products
                  </span>
                  <span className="flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                    Enter <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <WarehouseFormModal
          warehouse={modal.mode === 'edit' ? modal.warehouse : null}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
