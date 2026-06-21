import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';

const schema = z.object({
  type:        z.enum(['INVOICE', 'PAYMENT', 'CREDIT_NOTE', 'DEBIT_NOTE']),
  amount:      z.coerce.number({ invalid_type_error: 'Enter a number' }).positive('Must be greater than 0'),
  description: z.string().min(3, 'Description must be at least 3 characters'),
  reference:   z.string().optional(),
  date:        z.string().min(1, 'Date is required'),
  dueDate:     z.string().optional(),
}).refine((d) => {
  if (d.dueDate && d.date && d.dueDate < d.date) return false;
  return true;
}, { message: 'Due date must be on or after the transaction date', path: ['dueDate'] });

const TYPE_LABELS = {
  INVOICE:     'Invoice (charge)',
  PAYMENT:     'Payment received',
  CREDIT_NOTE: 'Credit Note',
  DEBIT_NOTE:  'Debit Note',
};

export default function TransactionForm({ onSubmit: onSubmitProp, isLoading }) {
  const today = new Date().toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { type: 'INVOICE', date: today },
  });

  const txType = watch('type');
  const showDueDate = txType === 'INVOICE';

  return (
    <form onSubmit={handleSubmit(onSubmitProp)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label>Transaction Type</Label>
          <Select {...register('type')}>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Amount (PKR)</Label>
          <Input type="number" min="0.01" step="0.01" placeholder="0.00" {...register('amount')} />
          {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Reference No.</Label>
          <Input placeholder="INV-0001 / PAY-0001" {...register('reference')} />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label>Description *</Label>
          <Input placeholder="Invoice for network cabling project..." {...register('description')} />
          {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" {...register('date')} />
          {errors.date && <p className="text-xs text-destructive">{errors.date.message}</p>}
        </div>
        {showDueDate && (
          <div className="space-y-1.5">
            <Label>Due Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input type="date" {...register('dueDate')} />
            {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate.message}</p>}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          Add Transaction
        </Button>
      </div>
    </form>
  );
}
