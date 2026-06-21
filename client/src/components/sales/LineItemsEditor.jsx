import { useFieldArray, useWatch } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import api from '../../lib/api';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}

export function LineItemsEditor({ control, register, setValue, showDiscount = true, showCostPrice = false }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const { data: products = [] } = useQuery({
    queryKey: ['products-active-list'],
    queryFn: () => api.get('/inventory/products?status=ACTIVE&limit=1000').then((r) => {
      const data = r.data;
      return Array.isArray(data) ? data : (data.products || []);
    }),
    staleTime: 60_000,
  });

  const watchedItems = useWatch({ control, name: 'items' }) || [];

  function onProductChange(index, productId) {
    const product = products.find((p) => p.id === Number(productId));
    if (!product) return;
    setValue(`items.${index}.description`, product.name);
    setValue(`items.${index}.unitPrice`, product.sellingPrice ?? 0);
    if (showCostPrice) setValue(`items.${index}.costPrice`, product.costPrice ?? 0);
  }

  function addRow() {
    append({ productId: '', description: '', quantity: 1, unitPrice: 0, discount: 0, costPrice: 0 });
  }

  const lineTotal = (item) => {
    const qty   = parseFloat(item?.quantity) || 0;
    const price = parseFloat(item?.unitPrice) || 0;
    const disc  = parseFloat(item?.discount) || 0;
    return qty * price * (1 - disc / 100);
  };

  const subtotal = watchedItems.reduce((s, item) => s + lineTotal(item), 0);

  return (
    <div className="space-y-2">
      {/* Table header */}
      <div className={`grid gap-2 text-xs font-medium text-muted-foreground px-1 ${showDiscount ? 'grid-cols-[2fr_1fr_1fr_0.7fr_1fr_32px]' : 'grid-cols-[2fr_1fr_1fr_1fr_32px]'}`}>
        <span>Description</span>
        <span>Qty</span>
        <span>Unit Price</span>
        {showDiscount && <span>Disc %</span>}
        <span className="text-right">Total</span>
        <span />
      </div>

      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">
          No items yet — add a line below
        </p>
      )}

      {fields.map((field, index) => {
        const item = watchedItems[index] || {};
        const total = lineTotal(item);
        return (
          <div
            key={field.id}
            className={`grid gap-2 items-start ${showDiscount ? 'grid-cols-[2fr_1fr_1fr_0.7fr_1fr_32px]' : 'grid-cols-[2fr_1fr_1fr_1fr_32px]'}`}
          >
            {/* Description + optional product selector */}
            <div className="space-y-1">
              <Select
                {...register(`items.${index}.productId`)}
                onChange={(e) => {
                  register(`items.${index}.productId`).onChange(e);
                  onProductChange(index, e.target.value);
                }}
                className="text-xs h-7"
              >
                <option value="">— Select product —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                ))}
              </Select>
              <Input
                className="text-xs h-7"
                placeholder="Description"
                {...register(`items.${index}.description`, { required: true })}
              />
            </div>

            <Input
              type="number" min="0.01" step="any"
              className="text-xs h-8"
              {...register(`items.${index}.quantity`, { min: 0.01 })}
            />

            <Input
              type="number" min="0" step="0.01"
              className="text-xs h-8"
              {...register(`items.${index}.unitPrice`)}
            />

            {showDiscount && (
              <Input
                type="number" min="0" max="100" step="0.1"
                className="text-xs h-8"
                placeholder="0"
                {...register(`items.${index}.discount`)}
              />
            )}

            {showCostPrice && (
              <Input
                type="number" min="0" step="0.01"
                className="text-xs h-8 hidden"
                {...register(`items.${index}.costPrice`)}
              />
            )}

            <div className="flex items-center justify-end h-8">
              <span className="text-xs font-medium text-right">{fmt(total)}</span>
            </div>

            <Button
              type="button" variant="ghost" size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => remove(index)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        );
      })}

      <div className="flex items-center justify-between pt-1">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="w-4 h-4" /> Add Line
        </Button>
        <div className="text-sm text-muted-foreground">
          Subtotal: <span className="font-semibold text-foreground">{fmt(subtotal)}</span>
        </div>
      </div>
    </div>
  );
}
