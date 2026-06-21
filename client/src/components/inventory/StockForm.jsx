import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';
import api from '../../lib/api';

const schema = z.object({
  quantity: z.coerce.number({ invalid_type_error: 'Enter a number' }).positive('Must be greater than 0'),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export default function StockForm({ product, type, onSuccess, onCancel }) {
  const isIn = type === 'in';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({ resolver: zodResolver(schema) });

  async function onSubmit(values) {
    try {
      const endpoint = isIn ? '/inventory/stock-in' : '/inventory/stock-out';
      await api.post(endpoint, { productId: product.id, ...values });
      onSuccess?.();
    } catch (err) {
      setError('root', { message: err.response?.data?.message || 'Operation failed' });
    }
  }

  return (
    <div className="space-y-4">
      {/* Product summary */}
      <div className={cn(
        'rounded-lg border p-4',
        isIn ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
      )}>
        <div className="flex items-center gap-2 mb-2">
          {isIn
            ? <ArrowDownCircle className="w-5 h-5 text-green-600" />
            : <ArrowUpCircle className="w-5 h-5 text-red-600" />
          }
          <span className={cn('font-semibold', isIn ? 'text-green-700' : 'text-red-700')}>
            {isIn ? 'Stock In' : 'Stock Out'}
          </span>
        </div>
        <p className="font-medium text-sm">{product.name}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="font-mono bg-white/70 px-1.5 py-0.5 rounded border">{product.sku}</span>
          <span>Current Stock: <strong>{product.quantity} {product.unitType}</strong></span>
          {!isIn && product.quantity <= 0 && (
            <span className="text-red-600 font-semibold">No stock available</span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {errors.root && (
          <div className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            {errors.root.message}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Quantity ({product.unitType})</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0"
              className="text-lg font-semibold"
              {...register('quantity')}
            />
            {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
            {!isIn && (
              <p className="text-xs text-muted-foreground">
                After operation: {product.quantity} → <span className="font-medium">?</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Reference No. <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input placeholder={isIn ? 'PO-0001' : 'SO-0001'} {...register('reference')} />
          </div>

          <div className="space-y-1.5">
            <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input placeholder="Reason or notes..." {...register('notes')} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || (!isIn && product.quantity <= 0)}
            className={isIn ? '' : 'bg-red-600 hover:bg-red-700'}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isIn ? 'Add Stock' : 'Remove Stock'}
          </Button>
        </div>
      </form>
    </div>
  );
}
