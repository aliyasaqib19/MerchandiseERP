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

const INDUSTRIES = [
  'Telecommunications', 'Construction', 'Technology', 'Healthcare',
  'Education', 'Retail', 'Manufacturing', 'Finance', 'Real Estate',
  'Government', 'Oil & Gas', 'Hospitality', 'Transportation', 'Other',
];

const phoneRegex = /^\+?[\d\s\-().]{7,20}$/;
const urlRegex = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/.*)?$/i;

const schema = z.object({
  companyName:  z.string().min(2, 'Company name is required'),
  industry:     z.string().optional(),
  email:        z.string().email('Invalid email address').optional().or(z.literal('')),
  phone:        z.string().regex(phoneRegex, 'Invalid phone number (e.g. +92 300 1234567)').optional().or(z.literal('')),
  mobile:       z.string().regex(phoneRegex, 'Invalid mobile number (e.g. +92 300 1234567)').optional().or(z.literal('')),
  website:      z.string().regex(urlRegex, 'Invalid website URL').optional().or(z.literal('')),
  address:      z.string().optional(),
  city:         z.string().optional(),
  country:      z.string().optional(),
  taxNumber:    z.string().optional(),
  creditLimit:  z.coerce.number().min(0, 'Must be 0 or more').optional().or(z.literal('')),
  status:       z.enum(['ACTIVE', 'INACTIVE', 'PROSPECT', 'BLACKLISTED']),
  notes:        z.string().optional(),
  // Primary contact (only on create)
  primaryContactName:   z.string().optional(),
  primaryContactTitle:  z.string().optional(),
  primaryContactEmail:  z.string().email('Invalid email address').optional().or(z.literal('')),
  primaryContactPhone:  z.string().regex(phoneRegex, 'Invalid phone number').optional().or(z.literal('')),
});

export default function ClientForm({ onSuccess, defaultValues, clientId }) {
  const isEdit = !!clientId;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName:  defaultValues?.companyName  || '',
      industry:     defaultValues?.industry     || '',
      email:        defaultValues?.email        || '',
      phone:        defaultValues?.phone        || '',
      mobile:       defaultValues?.mobile       || '',
      website:      defaultValues?.website      || '',
      address:      defaultValues?.address      || '',
      city:         defaultValues?.city         || '',
      country:      defaultValues?.country      || 'UAE',
      taxNumber:    defaultValues?.taxNumber    || '',
      creditLimit:  defaultValues?.creditLimit  || '',
      status:       defaultValues?.status       || 'ACTIVE',
      notes:        defaultValues?.notes        || '',
    },
  });

  async function onSubmit(values) {
    try {
      const {
        primaryContactName, primaryContactTitle, primaryContactEmail, primaryContactPhone,
        ...clientData
      } = values;

      const payload = {
        ...clientData,
        creditLimit: values.creditLimit === '' ? null : Number(values.creditLimit),
        primaryContact: !isEdit && primaryContactName ? {
          fullName: primaryContactName,
          title:    primaryContactTitle || null,
          email:    primaryContactEmail || null,
          phone:    primaryContactPhone || null,
        } : undefined,
      };

      if (isEdit) {
        await api.put(`/clients/${clientId}`, payload);
      } else {
        await api.post('/clients', payload);
      }
      onSuccess?.();
    } catch (err) {
      setError('root', { message: err.response?.data?.message || 'Something went wrong' });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
      {errors.root && (
        <div className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {errors.root.message}
        </div>
      )}

      {/* Company Info */}
      <section className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company Information</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Company Name *</Label>
            <Input placeholder="Gulf Telecom Solutions" {...register('companyName')} />
            {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Industry</Label>
            <Select {...register('industry')}>
              <option value="">Select industry...</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select {...register('status')}>
              <option value="ACTIVE">Active</option>
              <option value="PROSPECT">Prospect</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BLACKLISTED">Blacklisted</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" placeholder="info@company.com" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input placeholder="+92 42 111 2233" {...register('phone')} />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Mobile</Label>
            <Input placeholder="+92 300 1234567" {...register('mobile')} />
            {errors.mobile && <p className="text-xs text-destructive">{errors.mobile.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input placeholder="www.company.com" {...register('website')} />
            {errors.website && <p className="text-xs text-destructive">{errors.website.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Tax / NTN Number</Label>
            <Input placeholder="1234567-8" {...register('taxNumber')} />
          </div>
          <div className="space-y-1.5">
            <Label>Credit Limit (PKR)</Label>
            <Input type="number" min="0" step="100" placeholder="50000" {...register('creditLimit')} />
            {errors.creditLimit && <p className="text-xs text-destructive">{errors.creditLimit.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input placeholder="Street / Building" {...register('address')} />
          </div>
          <div className="space-y-1.5">
            <Label>City</Label>
            <Input placeholder="Dubai" {...register('city')} />
          </div>
          <div className="space-y-1.5">
            <Label>Country</Label>
            <Input placeholder="UAE" {...register('country')} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Internal Notes</Label>
            <textarea
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[64px] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Notes visible only to staff..."
              {...register('notes')}
            />
          </div>
        </div>
      </section>

      {/* Primary Contact (create only) */}
      {!isEdit && (
        <section className="space-y-3 border-t pt-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primary Contact Person</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input placeholder="Ahmed Al-Rashidi" {...register('primaryContactName')} />
            </div>
            <div className="space-y-1.5">
              <Label>Job Title</Label>
              <Input placeholder="Procurement Manager" {...register('primaryContactTitle')} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="ahmed@company.com" {...register('primaryContactEmail')} />
              {errors.primaryContactEmail && <p className="text-xs text-destructive">{errors.primaryContactEmail.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input placeholder="+92 300 1234567" {...register('primaryContactPhone')} />
              {errors.primaryContactPhone && <p className="text-xs text-destructive">{errors.primaryContactPhone.message}</p>}
            </div>
          </div>
        </section>
      )}

      <div className="flex justify-end gap-2 sticky bottom-0 bg-background pt-3 border-t">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create Client'}
        </Button>
      </div>
    </form>
  );
}
