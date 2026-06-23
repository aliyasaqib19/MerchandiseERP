import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ImagePlus, X, Plus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select } from '../ui/select';
import api from '../../lib/api';

const schema = z.object({
  sku: z.string().min(2, 'Manufacture number is required').toUpperCase(),
  name: z.string().min(2, 'Product name is required'),
  description: z.string().optional(),
  brandId: z.string().min(1, 'Brand is required'),
  unitType: z.enum(['PIECE', 'METER', 'KG', 'LITER', 'BOX', 'ROLL', 'SET']),
  quantity: z.coerce.number().min(0, 'Cannot be negative').optional(),
  minThreshold: z.coerce.number().min(0, 'Cannot be negative').optional(),
  costPrice: z.coerce.number().min(0, 'Cannot be negative').optional().or(z.literal('')),
  sellingPrice: z.coerce.number().min(0, 'Cannot be negative').optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE', 'DISCONTINUED']),
}).refine((d) => {
  const cost = d.costPrice === '' ? null : Number(d.costPrice);
  const sell = d.sellingPrice === '' ? null : Number(d.sellingPrice);
  if (cost != null && sell != null && sell < cost) return false;
  return true;
}, { message: 'Selling price must be ≥ cost price', path: ['sellingPrice'] });

const UNIT_TYPES = ['PIECE', 'METER', 'KG', 'LITER', 'BOX', 'ROLL', 'SET'];

export default function ProductForm({ onSuccess, defaultValues, productId, lockBrand }) {
  const isEdit = !!productId;
  const queryClient = useQueryClient();
  const [image, setImage] = useState(defaultValues?.imageUrl || '');
  const [imageError, setImageError] = useState('');
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandError, setNewBrandError] = useState('');
  const [creatingBrand, setCreatingBrand] = useState(false);

  function onImageChange(e) {
    const file = e.target.files?.[0];
    setImageError('');
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setImageError('Image must be under 5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);
  }

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: () => api.get('/brands').then((r) => r.data),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    setValue,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      sku: defaultValues?.sku || '',
      name: defaultValues?.name || '',
      description: defaultValues?.description || '',
      brandId: String(defaultValues?.brand?.id || defaultValues?.brandId || ''),
      unitType: defaultValues?.unitType || 'PIECE',
      quantity: defaultValues?.quantity ?? 0,
      minThreshold: defaultValues?.minThreshold ?? 0,
      costPrice: defaultValues?.costPrice ?? '',
      sellingPrice: defaultValues?.sellingPrice ?? '',
      status: defaultValues?.status || 'ACTIVE',
    },
  });

  async function handleCreateBrand() {
    const name = newBrandName.trim();
    setNewBrandError('');
    if (name.length < 2) { setNewBrandError('Brand name is required'); return; }
    setCreatingBrand(true);
    try {
      const { data: brand } = await api.post('/brands', { name });
      await queryClient.invalidateQueries({ queryKey: ['brands'] });
      setValue('brandId', String(brand.id), { shouldValidate: true });
      setShowNewBrand(false);
      setNewBrandName('');
    } catch (err) {
      setNewBrandError(err.response?.data?.message || 'Could not create brand');
    } finally {
      setCreatingBrand(false);
    }
  }

  async function onSubmit(values) {
    try {
      const payload = {
        ...values,
        brandId: Number(values.brandId),
        costPrice: values.costPrice === '' ? null : Number(values.costPrice),
        sellingPrice: values.sellingPrice === '' ? null : Number(values.sellingPrice),
        imageUrl: image || null,
      };

      if (isEdit) {
        const { quantity, ...editPayload } = payload;
        await api.put(`/inventory/products/${productId}`, editPayload);
      } else {
        await api.post('/inventory/products', payload);
      }
      onSuccess?.();
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong';
      if (msg.toLowerCase().includes('sku')) setError('sku', { message: msg });
      else setError('root', { message: msg });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {errors.root && (
        <div className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {errors.root.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Manufacture No. */}
        <div className="space-y-1.5">
          <Label>Manufacture No.</Label>
          <Input placeholder="e.g. ED-100" className="uppercase" {...register('sku')} disabled={isEdit} />
          {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select {...register('status')}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="DISCONTINUED">Discontinued</option>
          </Select>
        </div>

        {/* Name */}
        <div className="col-span-2 space-y-1.5">
          <Label>Product Name</Label>
          <Input placeholder="e.g. UTP Cable Cat6 (305m Box)" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        {/* Description */}
        <div className="col-span-2 space-y-1.5">
          <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <textarea
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Product description..."
            {...register('description')}
          />
        </div>

        {/* Product image */}
        <div className="col-span-2 space-y-1.5">
          <Label>Product Image <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <div className="flex items-center gap-3">
            {image ? (
              <div className="relative w-20 h-20 rounded-lg border overflow-hidden flex-shrink-0">
                <img src={image} alt="product" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImage('')}
                  className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="w-20 h-20 rounded-lg border border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-muted/40 text-muted-foreground flex-shrink-0">
                <ImagePlus className="w-5 h-5" />
                <span className="text-[10px] mt-1">Upload</span>
                <input type="file" accept="image/*" className="hidden" onChange={onImageChange} />
              </label>
            )}
            <p className="text-xs text-muted-foreground">PNG/JPG, max 5 MB</p>
          </div>
          {imageError && <p className="text-xs text-destructive">{imageError}</p>}
        </div>

        {/* Brand */}
        <div className="col-span-2 space-y-1.5">
          <Label>Brand</Label>
          {showNewBrand ? (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="New brand / vendor name (e.g. Saddar Local Market)"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateBrand(); } }}
                />
                <Button type="button" size="sm" onClick={handleCreateBrand} disabled={creatingBrand}>
                  {creatingBrand ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setShowNewBrand(false); setNewBrandName(''); setNewBrandError(''); }}>
                  Cancel
                </Button>
              </div>
              {newBrandError && <p className="text-xs text-destructive">{newBrandError}</p>}
            </div>
          ) : (
            <Select
              {...register('brandId')}
              disabled={lockBrand}
              onChange={(e) => {
                if (e.target.value === '__new__') { setShowNewBrand(true); return; }
                register('brandId').onChange(e);
              }}
            >
              <option value="">Select brand...</option>
              {!lockBrand && <option value="__new__">+ Create New Brand…</option>}
              {brands.map((b) => (
                <option key={b.id} value={String(b.id)}>{b.name}</option>
              ))}
            </Select>
          )}
          {errors.brandId && <p className="text-xs text-destructive">{errors.brandId.message}</p>}
          {!showNewBrand && !lockBrand && (
            <button
              type="button"
              onClick={() => setShowNewBrand(true)}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Create new brand / vendor
            </button>
          )}
        </div>

        {/* Unit Type */}
        <div className="space-y-1.5">
          <Label>Unit Type</Label>
          <Select {...register('unitType')}>
            {UNIT_TYPES.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </div>

        {/* Initial Quantity (create only) */}
        {!isEdit && (
          <div className="space-y-1.5">
            <Label>Initial Quantity</Label>
            <Input type="number" min="0" step="0.01" placeholder="0" {...register('quantity')} />
          </div>
        )}

        {/* Min Threshold */}
        <div className="space-y-1.5">
          <Label>Min. Stock Threshold</Label>
          <Input type="number" min="0" step="0.01" placeholder="0" {...register('minThreshold')} />
          <p className="text-xs text-muted-foreground">Alert when stock falls below this</p>
        </div>

        {/* Cost Price */}
        <div className="space-y-1.5">
          <Label>Cost Price (PKR) <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input type="number" min="0" step="0.01" placeholder="0.00" {...register('costPrice')} />
          {errors.costPrice && <p className="text-xs text-destructive">{errors.costPrice.message}</p>}
        </div>

        {/* Selling Price */}
        <div className="space-y-1.5">
          <Label>Selling Price (PKR) <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input type="number" min="0" step="0.01" placeholder="0.00" {...register('sellingPrice')} />
          {errors.sellingPrice && <p className="text-xs text-destructive">{errors.sellingPrice.message}</p>}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create Product'}
        </Button>
      </div>
    </form>
  );
}
