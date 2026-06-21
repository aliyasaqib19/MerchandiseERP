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
  clientId:        z.coerce.number().min(1, 'Client is required'),
  quotationId:     z.coerce.number().optional().or(z.literal('')),
  poDate:          z.string().optional(),
  expectedDelivery: z.string().optional(),
  notes:           z.string().optional(),
  taxRate:         z.coerce.number().min(0, 'Min 0').max(100, 'Max 100%').default(0),
  items:           z.array(z.object({
    productId:   z.union([z.string(), z.number()]).optional(),
    description: z.string().min(1, 'Description required'),
    quantity:    z.coerce.number().min(0.01, 'Must be > 0'),
    unitPrice:   z.coerce.number().min(0, 'Cannot be negative'),
  })).min(1, 'At least one item required'),
}).refine((d) => {
  if (d.expectedDelivery && d.poDate && d.expectedDelivery < d.poDate) return false;
  return true;
}, { message: 'Expected delivery must be on or after PO date', path: ['expectedDelivery'] });

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(n || 0);
}

export default function POForm({ onSuccess, defaultValues, poId }) {
  const isEdit = !!poId;
  const today  = new Date().toISOString().split('T')[0];

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-simple'],
    queryFn: () => api.get('/clients?limit=500').then((r) => Array.isArray(r.data) ? r.data : r.data.clients || []),
  });

  const { register, control, handleSubmit, setValue, watch, formState: { errors, isSubmitting }, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId:         defaultValues?.clientId || '',
      quotationId:      defaultValues?.quotationId || '',
      poDate:           defaultValues?.poDate?.split('T')[0] || today,
      expectedDelivery: defaultValues?.expectedDelivery?.split('T')[0] || '',
      notes:            defaultValues?.notes || '',
      taxRate:          defaultValues?.taxRate || 0,
      items:            defaultValues?.items?.map((i) => ({
        productId:   i.productId || '',
        description: i.description,
        quantity:    i.quantity,
        unitPrice:   i.unitPrice,
      })) || [{ productId: '', description: '', quantity: 1, unitPrice: 0 }],
    },
  });

  const clientId = useWatch({ control, name: 'clientId' });

  const { data: clientQuotations = [] } = useQuery({
    queryKey: ['client-quotations', clientId],
    queryFn: () => api.get(`/quotations?clientId=${clientId}&status=APPROVED&limit=100`).then((r) => r.data.quotations || []),
    enabled: !!clientId,
  });

  const watchedItems = useWatch({ control, name: 'items' }) || [];
  const taxRate      = parseFloat(useWatch({ control, name: 'taxRate' })) || 0;

  const subtotal  = watchedItems.reduce((s, i) => s + (parseFloat(i?.quantity) || 0) * (parseFloat(i?.unitPrice) || 0), 0);
  const taxAmount = subtotal * taxRate / 100;
  const total     = subtotal + taxAmount;

  async function onQuotationChange(quotationId) {
    if (!quotationId) return;
    try {
      const { data: q } = await api.get(`/quotations/${quotationId}`);
      setValue('clientId', q.clientId);
      setValue('taxRate', q.taxRate);
      setValue('items', q.items.map((item) => ({
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
        quotationId: values.quotationId ? Number(values.quotationId) : null,
        items: values.items.map((item) => ({
          ...item,
          productId: item.productId ? Number(item.productId) : null,
        })),
      };
      if (isEdit) {
        await api.put(`/purchase-orders/${poId}`, payload);
      } else {
        await api.post('/purchase-orders', payload);
      }
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
          <Label>Link to Quotation <span className="text-muted-foreground text-xs">(optional — auto-fills items)</span></Label>
          <Select
            {...register('quotationId')}
            onChange={(e) => {
              register('quotationId').onChange(e);
              if (e.target.value) onQuotationChange(e.target.value);
            }}
          >
            <option value="">None</option>
            {clientQuotations.map((q) => (
              <option key={q.id} value={q.id}>{q.quotationNumber} — {fmt(q.totalAmount)}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>PO Date</Label>
          <Input type="date" {...register('poDate')} />
        </div>
        <div className="space-y-1.5">
          <Label>Expected Delivery</Label>
          <Input type="date" {...register('expectedDelivery')} />
          {errors.expectedDelivery && <p className="text-xs text-destructive">{errors.expectedDelivery.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Tax Rate (%)</Label>
          <Input type="number" min="0" max="100" step="0.1" placeholder="0" {...register('taxRate')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Line Items *</Label>
        <LineItemsEditor control={control} register={register} setValue={setValue} showDiscount={false} />
      </div>

      <div className="flex justify-end border-t pt-3">
        <div className="w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{fmt(subtotal)}</span>
          </div>
          {taxAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax ({taxRate}%)</span>
              <span>{fmt(taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold border-t pt-1">
            <span>Total</span>
            <span>{fmt(total)}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <textarea
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[64px] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Notes or special instructions..."
          {...register('notes')}
        />
      </div>

      <div className="flex justify-end gap-2 sticky bottom-0 bg-background pt-3 border-t">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create Purchase Order'}
        </Button>
      </div>
    </form>
  );
}
