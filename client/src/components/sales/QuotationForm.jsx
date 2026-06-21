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
  clientId:     z.coerce.number().min(1, 'Client is required'),
  validUntil:   z.string().optional(),
  notes:        z.string().optional(),
  terms:        z.string().optional(),
  discountType:  z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
  discountValue: z.coerce.number().min(0, 'Cannot be negative').default(0),
  taxRate:       z.coerce.number().min(0, 'Min 0').max(100, 'Max 100%').default(0),
  items:         z.array(z.object({
    productId:   z.union([z.string(), z.number()]).optional(),
    description: z.string().min(1, 'Description required'),
    quantity:    z.coerce.number().min(0.01, 'Must be > 0'),
    unitPrice:   z.coerce.number().min(0, 'Cannot be negative'),
    discount:    z.coerce.number().min(0, 'Min 0').max(100, 'Max 100%').default(0),
  })).min(1, 'At least one item required'),
}).refine((d) => {
  if (d.validUntil && d.validUntil < new Date().toISOString().split('T')[0]) return false;
  return true;
}, { message: 'Valid until date cannot be in the past', path: ['validUntil'] });

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(n || 0);
}

export default function QuotationForm({ onSuccess, defaultValues, quotationId }) {
  const isEdit = !!quotationId;

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-simple'],
    queryFn: () => api.get('/clients?limit=500').then((r) => Array.isArray(r.data) ? r.data : r.data.clients || []),
  });

  const { register, control, handleSubmit, setValue, watch, formState: { errors, isSubmitting }, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId:      defaultValues?.clientId || '',
      validUntil:    defaultValues?.validUntil ? defaultValues.validUntil.split('T')[0] : '',
      notes:         defaultValues?.notes || '',
      terms:         defaultValues?.terms || '',
      discountType:  defaultValues?.discountType || 'PERCENTAGE',
      discountValue: defaultValues?.discountValue || 0,
      taxRate:       defaultValues?.taxRate || 0,
      items:         defaultValues?.items?.map((i) => ({
        productId:   i.productId || '',
        description: i.description,
        quantity:    i.quantity,
        unitPrice:   i.unitPrice,
        discount:    i.discount || 0,
      })) || [{ productId: '', description: '', quantity: 1, unitPrice: 0, discount: 0 }],
    },
  });

  const watchedItems    = useWatch({ control, name: 'items' }) || [];
  const discountType    = useWatch({ control, name: 'discountType' }) || 'PERCENTAGE';
  const discountValue   = parseFloat(useWatch({ control, name: 'discountValue' })) || 0;
  const taxRate         = parseFloat(useWatch({ control, name: 'taxRate' })) || 0;

  const subtotal = watchedItems.reduce((s, item) => {
    return s + (parseFloat(item?.quantity) || 0) * (parseFloat(item?.unitPrice) || 0) * (1 - (parseFloat(item?.discount) || 0) / 100);
  }, 0);
  const discountAmount = discountType === 'PERCENTAGE' ? subtotal * discountValue / 100 : discountValue;
  const taxAmount      = (subtotal - discountAmount) * taxRate / 100;
  const totalAmount    = subtotal - discountAmount + taxAmount;

  async function onSubmit(values) {
    try {
      const payload = {
        ...values,
        items: values.items.map((item) => ({
          ...item,
          productId: item.productId ? Number(item.productId) : null,
        })),
      };
      if (isEdit) {
        await api.put(`/quotations/${quotationId}`, payload);
      } else {
        await api.post('/quotations', payload);
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

      {/* Header */}
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
          <Label>Valid Until</Label>
          <Input type="date" {...register('validUntil')} />
          {errors.validUntil && <p className="text-xs text-destructive">{errors.validUntil.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Tax Rate (%)</Label>
          <Input type="number" min="0" max="100" step="0.1" placeholder="0" {...register('taxRate')} />
        </div>
      </div>

      {/* Line Items */}
      <div className="space-y-2">
        <Label>Line Items *</Label>
        {errors.items && <p className="text-xs text-destructive">{errors.items.message || errors.items.root?.message}</p>}
        <LineItemsEditor control={control} register={register} setValue={setValue} showDiscount />
      </div>

      {/* Discount + Totals */}
      <div className="border-t pt-4">
        <div className="flex justify-end">
          <div className="w-72 space-y-2">
            <div className="grid grid-cols-2 gap-2 items-center">
              <Label className="text-right">Discount</Label>
              <div className="flex gap-1">
                <Select {...register('discountType')} className="w-24 text-xs">
                  <option value="PERCENTAGE">%</option>
                  <option value="FIXED">Fixed</option>
                </Select>
                <Input type="number" min="0" step="0.01" placeholder="0" {...register('discountValue')} className="text-xs" />
              </div>
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
                <span>{fmt(totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes + Terms */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <textarea
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Internal notes..."
            {...register('notes')}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Terms & Conditions</Label>
          <textarea
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Payment terms, delivery conditions..."
            {...register('terms')}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 sticky bottom-0 bg-background pt-3 border-t">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create Quotation'}
        </Button>
      </div>
    </form>
  );
}
