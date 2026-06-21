import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const schema = z.object({
  fullName:  z.string().min(2, 'Name is required'),
  title:     z.string().optional(),
  email:     z.string().email().optional().or(z.literal('')),
  phone:     z.string().optional(),
  mobile:    z.string().optional(),
  isPrimary: z.boolean().optional(),
});

export default function ContactForm({ onSubmit: onSubmitProp, defaultValues, isLoading }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName:  defaultValues?.fullName  || '',
      title:     defaultValues?.title     || '',
      email:     defaultValues?.email     || '',
      phone:     defaultValues?.phone     || '',
      mobile:    defaultValues?.mobile    || '',
      isPrimary: defaultValues?.isPrimary ?? false,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmitProp)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Full Name *</Label>
          <Input placeholder="Ahmed Al-Rashidi" {...register('fullName')} />
          {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Job Title</Label>
          <Input placeholder="Procurement Manager" {...register('title')} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" placeholder="ahmed@company.com" {...register('email')} />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input placeholder="+971 50 111 2233" {...register('phone')} />
        </div>
        <div className="space-y-1.5">
          <Label>Mobile</Label>
          <Input placeholder="+971 50 111 2234" {...register('mobile')} />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <input id="isPrimary" type="checkbox" {...register('isPrimary')} className="w-4 h-4 rounded text-primary" />
          <Label htmlFor="isPrimary" className="font-normal cursor-pointer">Set as primary contact</Label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {defaultValues ? 'Save Changes' : 'Add Contact'}
        </Button>
      </div>
    </form>
  );
}
