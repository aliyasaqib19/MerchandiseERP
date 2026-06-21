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
  clientId:      z.coerce.number().min(1, 'Client is required'),
  quotationId:   z.coerce.number().optional().or(z.literal('')),
  poId:          z.coerce.number().optional().or(z.literal('')),
  saleDate:      z.string().optional(),
  notes:         z.string().optional(),
  discountAmount: z.coerce.number().min(0).default(0),
  taxRate:       z.coerce.number().min(0).max(100).default(0),
  items:         z.array(z.object({
    productId:   z.union([z.string(), z.number()]).optional(),
    description: z.string().min(1),
    quantity:    z.coerce.number().min(0.01),
    unitPrice:   z.coerce.number().min(0),
    costPrice:   z.coerce.number().min(0).default(0),
    discount:    z.coerce.number().min(0).max(100).default(0),
  })).min(1),
});

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(n || 0);
}

export default function SaleForm({ onSuccess, defaultValues, saleId }) {
  const isEdit = !!saleId;
  const today  = new Date().toISOString().split('T')[0];

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-simple'],
    queryFn: () => api.get('/clients?limit=500').then((r) => Array.isArray(r.data) ? r.data : r.data.clients || []),
  });

  const { register, control, handleSubmit, setValue, watch, formState: { errors, isSubmitting }, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId:       defaultValues?.clientId || '',
      quotationId:    defaultValues?.quotationId || '',
      poId:           defaultValues?.poId || '',
      saleDate:       defaultValues?.saleDate?.split('T')[0] || today,
      notes:          defaultValues?.notes || '',
      discountAmount: defaultValues?.discountAmount || 0,
      taxRate:        defaultValues?.taxRate || 0,
      items:          defaultValues?.items?.map((i) => ({
        productId:   i.productId || '',
        description: i.description,
        quantity:    i.quantity,
        unitPrice:   i.unitPrice,
        costPrice:   i.costPrice || 0,
        discount:    i.discount || 0,
      })) || [{ productId: '', description: '', quantity: 1, unitPrice: 0, costPrice: 0, discount: 0 }],
    },
  });

  const clientId = useWatch({ control, name: 'clientId' });

  const { data: clientQuotations = [] } = useQuery({
    queryKey: ['client-quotations', clientId],
    queryFn: () => api.get(`/quotations?clientId=${clientId}&status=APPROVED&limit=100`).then((r) => r.data.quotations || []),
    enabled: !!clientId,
  });

  const { data: clientPOs = [] } = useQuery({
    queryKey: ['client-pos', clientId],
    queryFn: () => api.get(`/purchase-orders?clientId=${clientId}&status=APPROVED&limit=100`).then((r) => r.data.purchaseOrders || []),
    enabled: !!clientId,
  });

  const watchedItems    = useWatch({ control, name: 'items' }) || [];
  const discountAmount  = parseFloat(useWatch({ control, name: 'discountAmount' })) || 0;
  const taxRate         = parseFloat(useWatch({ control, name: 'taxRate' })) || 0;

  const subtotal   = watchedItems.reduce((s, i) =>
    s + (parseFloat(i?.quantity) || 0) * (parseFloat(i?.unitPrice) || 0) * (1 - (parseFloat(i?.discount) || 0) / 100), 0);
  const taxAmount  = (subtotal - discountAmount) * taxRate / 100;
  const total      = subtotal - discountAmount + taxAmount;

  async function prefillFrom(type, id) {
    if (!id) return;
    try {
      const url = type === 'quotation' ? `/quotations/${id}` : `/purchase-orders/${id}`;
      const { data: doc } = await api.get(url);
      setValue('clientId', doc.clientId);
      setValue('discountAmount', doc.discountAmount || 0);
      setValue('taxRate', doc.taxRate);
      setValue('items', (doc.items || []).map((item) => ({
        productId:   item.productId || '',
        description: item.description,
        quantity:    item.quantity,
        unitPrice:   item.unitPrice,
        costPrice:   item.costPrice || 0,
        discount:    item.discount || 0,
      })));
    } catch {}
  }

  async function onSubmit(values) {
    try {
      const payload = {
        ...values,
        quotationId: values.quotationId ? Number(values.quotationId) : null,
        poId:        values.poId ? Number(values.poId) : null,
        items: values.items.map((item) => ({
          ...item,
          productId: item.productId ? Number(item.productId) : null,
        })),
      };
      if (isEdit) {
        await api.put(`/sales/${saleId}`, payload);
      } else {
        await api.post('/sales', payload);
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

        <div className="space-y-1.5">
          <Label>From Quotation <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Select
            {...register('quotationId')}
            onChange={(e) => {
              register('quotationId').onChange(e);
              if (e.target.value) prefillFrom('quotation', e.target.value);
            }}
          >
            <option value="">None</option>
            {clientQuotations.map((q) => (
              <option key={q.id} value={q.id}>{q.quotationNumber}</option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>From PO <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Select
            {...register('poId')}
            onChange={(e) => {
              register('poId').onChange(e);
              if (e.target.value) prefillFrom('po', e.target.value);
            }}
          >
            <option value="">None</option>
            {clientPOs.map((po) => (
              <option key={po.id} value={po.id}>{po.poNumber}</option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Sale Date</Label>
          <Input type="date" {...register('saleDate')} />
        </div>
        <div className="space-y-1.5">
          <Label>Tax Rate (%)</Label>
          <Input type="number" min="0" max="100" step="0.1" placeholder="0" {...register('taxRate')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Line Items *</Label>
        {errors.items && <p className="text-xs text-destructive">At least one item required</p>}
        <LineItemsEditor control={control} register={register} setValue={setValue} showDiscount showCostPrice />
      </div>

      <div className="flex justify-end border-t pt-3">
        <div className="w-72 space-y-2">
          <div className="grid grid-cols-2 gap-2 items-center">
            <Label className="text-right text-xs">Discount (Fixed)</Label>
            <Input type="number" min="0" step="0.01" placeholder="0" {...register('discountAmount')} className="text-xs" />
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Discount</span>
                <span>- {fmt(discountAmount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Tax ({taxRate}%)</span>
                <span>{fmt(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base border-t pt-1">
              <span>Total</span>
              <span>{fmt(total)}</span>
            </div>
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
          {isEdit ? 'Save Changes' : 'Create Sale'}
        </Button>
      </div>
    </form>
  );
}
