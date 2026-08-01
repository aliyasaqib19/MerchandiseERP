import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { LineItemsEditor } from './LineItemsEditor';
import api from '../../lib/api';

const schema = z.object({
  clientId:   z.coerce.number().min(1, 'Client is required'),
  saleId:     z.coerce.number().optional().or(z.literal('')),
  reason:     z.string().optional(),
  notes:      z.string().optional(),
  returnDate: z.string().optional(),
  items:      z.array(z.object({
    productId:   z.union([z.string(), z.number()]).optional(),
    description: z.string().min(1, 'Description required'),
    quantity:    z.coerce.number().min(0.01, 'Must be > 0'),
    unitPrice:   z.coerce.number().min(0, 'Cannot be negative'),
  })).min(1, 'At least one item required'),
});

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(n || 0);
}

export default function ReturnForm({ onSuccess }) {
  const today = new Date().toISOString().split('T')[0];

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-simple'],
    queryFn: () => api.get('/clients?limit=500').then((r) => Array.isArray(r.data) ? r.data : r.data.clients || []),
  });

  const { register, control, handleSubmit, setValue, formState: { errors, isSubmitting }, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: '',
      saleId: '',
      reason: '',
      notes: '',
      returnDate: today,
      items: [{ productId: '', description: '', quantity: 1, unitPrice: 0 }],
    },
  });

  const clientId = useWatch({ control, name: 'clientId' });

  const { data: clientSales = [] } = useQuery({
    queryKey: ['client-sales-delivered', clientId],
    queryFn: () => api.get(`/sales?clientId=${clientId}&status=DELIVERED&limit=100`).then((r) => r.data.sales || []),
    enabled: !!clientId,
  });

  const watchedItems = useWatch({ control, name: 'items' }) || [];
  const subtotal = watchedItems.reduce((s, i) => s + (parseFloat(i?.quantity) || 0) * (parseFloat(i?.unitPrice) || 0), 0);

  async function onSaleChange(saleId) {
    if (!saleId) return;
    try {
      const { data: sale } = await api.get(`/sales/${saleId}`);
      setValue('items', (sale.items || []).map((item) => ({
        productId:   item.productId || '',
        description: item.description,
        quantity:    item.quantity,
        unitPrice:   item.unitPrice,
      })));
    } catch {}
  }

  async function onSubmit(values) {
    try {
      const payload = {
        ...values,
        saleId: values.saleId ? Number(values.saleId) : null,
        items: values.items.map((item) => ({
          ...item,
          productId: item.productId ? Number(item.productId) : null,
        })),
      };
      await api.post('/returns', payload);
      onSuccess?.();
    } catch (err) {
      setError('root', { message: err.response?.data?.message || 'Something went wrong' });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-h-[80vh] overflow-y-auto pr-1">
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
          <Label>From Delivered Sale <span className="text-muted-foreground text-xs">(optional — auto-fills items)</span></Label>
          <Select
            {...register('saleId')}
            onChange={(e) => {
              register('saleId').onChange(e);
              if (e.target.value) onSaleChange(e.target.value);
            }}
          >
            <option value="">None</option>
            {clientSales.map((s) => (
              <option key={s.id} value={s.id}>{s.saleNumber}</option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Return Date</Label>
          <Input type="date" {...register('returnDate')} />
        </div>
        <div className="space-y-1.5">
          <Label>Reason</Label>
          <Input placeholder="Damaged, wrong item, etc." {...register('reason')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Line Items *</Label>
        {errors.items && <p className="text-xs text-destructive">At least one item required</p>}
        <LineItemsEditor control={control} register={register} setValue={setValue} showDiscount={false} />
      </div>

      <div className="flex justify-end border-t pt-3">
        <div className="w-64 space-y-1 text-sm">
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{fmt(subtotal)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <textarea
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Internal notes..."
          {...register('notes')}
        />
      </div>

      <div className="flex justify-end gap-2 sticky bottom-0 bg-background pt-3 border-t">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Record Return
        </Button>
      </div>
    </form>
  );
}
