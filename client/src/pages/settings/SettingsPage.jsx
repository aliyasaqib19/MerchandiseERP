import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Globe, DollarSign, CheckCircle, Loader2, Info } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { useAuthStore } from '../../store/authStore';

const phoneRegex = /^\+?[\d\s\-().]{7,20}$/;

const schema = z.object({
  companyName:  z.string().min(2, 'Company name is required'),
  email:        z.string().email('Invalid email address').optional().or(z.literal('')),
  phone:        z.string().regex(phoneRegex, 'Invalid phone number').optional().or(z.literal('')),
  address:      z.string().optional(),
  city:         z.string().optional(),
  country:      z.string().optional(),
  currency:     z.string().min(1),
  timezone:     z.string().min(1),
  taxRate:      z.coerce.number().min(0, 'Min 0').max(100, 'Max 100'),
  ntn:          z.string().optional(),
  website:      z.string().optional(),
});

const TIMEZONES = [
  'Asia/Karachi', 'Asia/Dubai', 'Asia/Kolkata', 'UTC',
  'Europe/London', 'America/New_York', 'America/Los_Angeles',
];

const CURRENCIES = ['PKR', 'USD', 'AED', 'GBP', 'EUR', 'INR', 'SAR'];

const STORAGE_KEY = 'merchandise_settings';

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function SuccessBanner() {
  return (
    <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
      <CheckCircle className="w-4 h-4 flex-shrink-0" />
      Settings saved successfully
    </div>
  );
}

export default function SettingsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canEdit = hasPermission('SETTINGS_UPDATE');
  const [saved, setSaved] = useState(false);

  const saved_settings = loadSettings();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: saved_settings?.companyName || 'Merchandise ERP',
      email:       saved_settings?.email       || '',
      phone:       saved_settings?.phone       || '',
      address:     saved_settings?.address     || '',
      city:        saved_settings?.city        || '',
      country:     saved_settings?.country     || 'Pakistan',
      currency:    saved_settings?.currency    || 'PKR',
      timezone:    saved_settings?.timezone    || 'Asia/Karachi',
      taxRate:     saved_settings?.taxRate     ?? 0,
      ntn:         saved_settings?.ntn         || '',
      website:     saved_settings?.website     || '',
    },
  });

  function onSubmit(values) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
    setSaved(true);
    setTimeout(() => setSaved(false), 4000);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure company information and system preferences</p>
      </div>

      {!canEdit && (
        <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
          <Info className="w-4 h-4 flex-shrink-0" />
          You have view-only access to settings. Contact your administrator to make changes.
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {saved && <SuccessBanner />}

        {/* Company Info */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">Company Information</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Company Name *</Label>
              <Input placeholder="Merchandise ERP" {...register('companyName')} disabled={!canEdit} />
              {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" placeholder="info@company.com" {...register('email')} disabled={!canEdit} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input placeholder="+92 42 111 0000" {...register('phone')} disabled={!canEdit} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input placeholder="www.company.com" {...register('website')} disabled={!canEdit} />
            </div>
            <div className="space-y-1.5">
              <Label>NTN Number</Label>
              <Input placeholder="1234567-8" {...register('ntn')} disabled={!canEdit} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Address</Label>
              <Input placeholder="Street / Building" {...register('address')} disabled={!canEdit} />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input placeholder="Lahore" {...register('city')} disabled={!canEdit} />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input placeholder="Pakistan" {...register('country')} disabled={!canEdit} />
            </div>
          </div>
        </div>

        {/* System Preferences */}
        <div className="bg-white border rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">System Preferences</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select {...register('currency')} disabled={!canEdit}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Select {...register('timezone')} disabled={!canEdit}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default Tax Rate (%)</Label>
              <Input type="number" min="0" max="100" step="0.1" placeholder="0" {...register('taxRate')} disabled={!canEdit} />
              {errors.taxRate && <p className="text-xs text-destructive">{errors.taxRate.message}</p>}
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Settings
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
