import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import api from '../../lib/api';

const PAYMENT_METHODS = ['Bank Transfer', 'Cash', 'Cheque', 'Online / Card', 'Other'];

const schema = z.object({
  clientId:      z.coerce.number().min(1, 'Client is required'),
  amount:        z.coerce.number({ invalid_type_error: 'Enter an amount' }).positive('Must be > 0'),
  paymentMethod: z.string().min(1, 'Select a method'),
  reference:     z.string().optional(),
  description:   z.string().optional(),
  date:          z.string().min(1, 'Date is required'),
});

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(n || 0);
}

export default function PaymentForm({ onSuccess, defaultClientId }) {
  const today = new Date().toISOString().split('T')[0];

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-simple'],
    queryFn: () => api.get('/clients?limit=500').then((r) => Array.isArray(r.data) ? r.data : r.data.clients || []),
  });

  const {
    register, handleSubmit, watch, setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId:      defaultClientId || '',
      amount:        '',
      paymentMethod: 'Bank Transfer',
      reference:     '',
      description:   'Payment received',
      date:          today,
    },
  });

  const selectedClientId = watch('clientId');

  const { data: clientBalance } = useQuery({
    queryKey: ['client-balance-quick', selectedClientId],
    queryFn: () => api.get(`/finance/clients/${selectedClientId}/balance`).then((r) => r.data),
    enabled: !!selectedClientId,
  });

  async function onSubmit(values) {
    try {
      await api.post('/finance/payments', values);
      onSuccess?.();
    } catch (err) {
      setError('root', { message: err.response?.data?.message || 'Failed to record payment' });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errors.root && (
        <div className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {errors.root.message}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Client *</Label>
        <Select {...register('clientId')}>
          <option value="">Select client...</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
        </Select>
        {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}

        {clientBalance && (
          <div className={`text-xs px-3 py-2 rounded-md font-medium ${
            clientBalance.outstandingBalance > 0
              ? 'bg-orange-50 text-orange-700 border border-orange-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            Outstanding balance: {fmt(clientBalance.outstandingBalance)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Amount (PKR) *</Label>
          <Input
            type="number" min="0.01" step="0.01" placeholder="0.00"
            {...register('amount')}
          />
          {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Payment Date *</Label>
          <Input type="date" {...register('date')} />
          {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Payment Method *</Label>
          <Select {...register('paymentMethod')}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Reference / Cheque #</Label>
          <Input placeholder="TRF-20240101" {...register('reference')} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Description</Label>
          <Input placeholder="Payment received" {...register('description')} />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white">
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Record Payment
        </Button>
      </div>
    </form>
  );
}
