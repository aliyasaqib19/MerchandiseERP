import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import api from '../../lib/api';

const schema = z.object({
  clientId:           z.coerce.number().min(1, 'Client is required'),
  productId:          z.coerce.number().min(1, 'Product is required'),
  quantity:           z.coerce.number().min(0.01, 'Must be > 0'),
  dateOut:            z.string().optional(),
  expectedReturnDate: z.string().optional(),
  notes:              z.string().optional(),
});

export default function DemoForm({ onSuccess }) {
  const today = new Date().toISOString().split('T')[0];

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-simple'],
    queryFn: () => api.get('/clients?limit=500').then((r) => Array.isArray(r.data) ? r.data : r.data.clients || []),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products-active-list'],
    queryFn: () => api.get('/inventory/products?status=ACTIVE&limit=1000').then((r) => {
      const data = r.data;
      return Array.isArray(data) ? data : (data.products || []);
    }),
    staleTime: 60_000,
  });

  const { register, control, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: '',
      productId: '',
      quantity: 1,
      dateOut: today,
      expectedReturnDate: '',
      notes: '',
    },
  });

  const productId = useWatch({ control, name: 'productId' });
  const quantity  = useWatch({ control, name: 'quantity' });
  const selectedProduct = products.find((p) => p.id === Number(productId));

  async function onSubmit(values) {
    try {
      await api.post('/demo-items', values);
      onSuccess?.();
    } catch (err) {
      setError('root', { message: err.response?.data?.message || 'Something went wrong' });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {errors.root && (
        <div className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {errors.root.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Client *</Label>
          <Select {...register('clientId')}>
            <option value="">Select client...</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
          </Select>
          {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label>Product *</Label>
          <Select {...register('productId')}>
            <option value="">Select product...</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name} (in stock: {p.quantity})</option>)}
          </Select>
          {errors.productId && <p className="text-xs text-destructive">{errors.productId.message}</p>}
          {selectedProduct && Number(quantity) > selectedProduct.quantity && (
            <p className="text-xs text-destructive">Only {selectedProduct.quantity} in stock</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Quantity *</Label>
          <Input type="number" min="0.01" step="any" {...register('quantity')} />
          {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Date Out</Label>
          <Input type="date" {...register('dateOut')} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Expected Return Date</Label>
          <Input type="date" {...register('expectedReturnDate')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <textarea
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Purpose of demo, contact person, etc..."
          {...register('notes')}
        />
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Send Demo Unit
        </Button>
      </div>
    </form>
  );
}
