import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag, Plus, Package, ArrowRight, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';

function AddBrandModal({ onClose }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const create = useMutation({
    mutationFn: (data) => api.post('/brands', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent onClose={onClose}>
        <DialogHeader><DialogTitle>Add Brand</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate({ name: name.trim(), description }); }}
          className="space-y-4"
        >
          <div>
            <label className="text-sm font-medium mb-1 block">Brand Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. INIM" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          {create.isError && (
            <p className="text-sm text-red-600">{create.error?.response?.data?.message || 'Failed to add brand'}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Add Brand
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function BrandsPage() {
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [showAdd, setShowAdd] = useState(false);

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['brands'],
    queryFn: () => api.get('/brands').then((r) => r.data),
  });

  const del = useMutation({
    mutationFn: (id) => api.delete(`/brands/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brands'] }),
    onError: (e) => alert(e?.response?.data?.message || 'Delete failed'),
  });

  const canManage = hasPermission('INVENTORY_CREATE');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Tag className="w-6 h-6" /> Brands</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Browse products by brand and see client distribution</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" /> Add Brand</Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="border rounded-2xl h-32 bg-muted/40 animate-pulse" />)}
        </div>
      ) : brands.length === 0 ? (
        <div className="text-center py-16 border rounded-xl">
          <Tag className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No brands yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add a brand to organize your products.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map((b) => (
            <Link
              key={b.id}
              to={`/inventory/brands/${b.id}`}
              className="group border rounded-2xl p-5 hover:shadow-lg hover:border-primary/40 transition-all relative"
            >
              {hasPermission('INVENTORY_DELETE') && (
                <button
                  onClick={(e) => { e.preventDefault(); if (window.confirm(`Delete brand "${b.name}"? Products stay but lose this brand.`)) del.mutate(b.id); }}
                  className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Tag className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">{b.name}</h3>
              {b.description && <p className="text-xs text-muted-foreground mt-0.5">{b.description}</p>}
              <div className="flex items-center justify-between mt-4 pt-3 border-t">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  <span className="font-semibold text-foreground">{b.productCount}</span> product{b.productCount !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                  View <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showAdd && <AddBrandModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}
