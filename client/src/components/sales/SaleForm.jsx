import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { LineItemsEditor } from './LineItemsEditor';
import ClientForm from '../clients/ClientForm';
import api from '../../lib/api';

const schema = z.object({
  clientId:      z.coerce.number().min(1, 'Client is required'),
  saleDate:      z.string().optional(),
  notes:         z.string().optional(),
  deliveryChallanNumber: z.string().optional(),
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
  const queryClient = useQueryClient();
  const [showAddClient, setShowAddClient] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-simple'],
    queryFn: () => api.get('/clients?limit=500').then((r) => Array.isArray(r.data) ? r.data : r.data.clients || []),
  });

  const { register, control, handleSubmit, setValue, watch, formState: { errors, isSubmitting }, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId:       defaultValues?.clientId || '',
      saleDate:       defaultValues?.saleDate?.split('T')[0] || today,
      notes:          defaultValues?.notes || '',
      deliveryChallanNumber: defaultValues?.deliveryChallanNumber || '',
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

  const watchedItems    = useWatch({ control, name: 'items' }) || [];
  const discountAmount  = parseFloat(useWatch({ control, name: 'discountAmount' })) || 0;
  const taxRate         = parseFloat(useWatch({ control, name: 'taxRate' })) || 0;

  const subtotal   = watchedItems.reduce((s, i) =>
    s + (parseFloat(i?.quantity) || 0) * (parseFloat(i?.unitPrice) || 0) * (1 - (parseFloat(i?.discount) || 0) / 100), 0);
  const taxAmount  = (subtotal - discountAmount) * taxRate / 100;
  const total      = subtotal - discountAmount + taxAmount;

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
          <div className="flex gap-2">
            <Select {...register('clientId')} className="flex-1">
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
            </Select>
            <Button type="button" variant="outline" onClick={() => setShowAddClient(true)}>
              <Plus className="w-4 h-4" /> Add New Client
            </Button>
          </div>
          {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Delivery Challan Number</Label>
          <Input placeholder="DC-0001" {...register('deliveryChallanNumber')} />
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

      <Dialog open={showAddClient} onOpenChange={setShowAddClient}>
        <DialogContent className="max-w-2xl" onClose={() => setShowAddClient(false)}>
          <DialogHeader><DialogTitle>Add New Client</DialogTitle></DialogHeader>
          <ClientForm
            onSuccess={async (newClient) => {
              setShowAddClient(false);
              await queryClient.invalidateQueries({ queryKey: ['clients-simple'] });
              // The refetched <option> isn't in the DOM the instant this
              // promise resolves — React hasn't flushed the re-render yet —
              // so setting the select's value here would silently no-op.
              // Deferring one tick lets that render land first.
              if (newClient?.id) setTimeout(() => setValue('clientId', newClient.id), 0);
            }}
          />
        </DialogContent>
      </Dialog>
    </form>
  );
}
