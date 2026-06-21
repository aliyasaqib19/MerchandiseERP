import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import api from '../../lib/api';

const phoneRegex = /^\+?[\d\s\-().]{7,20}$/;
const passwordRegex = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

const createSchema = z.object({
  fullName: z.string().min(2, 'Full name required'),
  email: z.string().email('Valid email address required'),
  phone: z.string().regex(phoneRegex, 'Invalid phone number (e.g. +92 300 1234567)').optional().or(z.literal('')),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(passwordRegex, 'Must contain at least one uppercase letter and one special character'),
  roleId: z.string().min(1, 'Role is required'),
  branchId: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
});

const editSchema = createSchema.extend({
  password: z.string()
    .refine((v) => !v || v.length >= 8, 'Password must be at least 8 characters')
    .refine((v) => !v || passwordRegex.test(v), 'Must contain at least one uppercase letter and one special character')
    .optional(),
});

export default function CreateUserForm({ onSuccess, defaultValues, userId }) {
  const isEdit = !!userId;

  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((r) => r.data),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: {
      fullName: defaultValues?.fullName || '',
      email: defaultValues?.email || '',
      phone: defaultValues?.phone || '',
      password: '',
      roleId: String(defaultValues?.role?.id || ''),
      branchId: String(defaultValues?.branch?.id || ''),
      status: defaultValues?.status || 'ACTIVE',
    },
  });

  async function onSubmit(values) {
    try {
      if (isEdit) {
        const payload = { ...values };
        if (!payload.password) delete payload.password;
        await api.put(`/users/${userId}`, payload);
      } else {
        await api.post('/users', values);
      }
      onSuccess?.();
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong';
      if (msg.toLowerCase().includes('email')) {
        setError('email', { message: msg });
      } else {
        setError('root', { message: msg });
      }
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
        <div className="space-y-1.5 col-span-2">
          <Label>Full Name</Label>
          <Input placeholder="John Doe" {...register('fullName')} />
          {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input type="email" placeholder="john@company.com" {...register('email')} />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input type="tel" placeholder="+92 300 1234567" {...register('phone')} />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>

        <div className="space-y-1.5 col-span-2">
          <Label>{isEdit ? 'New Password (leave blank to keep)' : 'Password'}</Label>
          <Input type="password" placeholder="••••••••" {...register('password')} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          <p className="text-xs text-muted-foreground">Min 8 chars, one uppercase letter, one special character (e.g. Test@1234)</p>
        </div>

        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select {...register('roleId')}>
            <option value="">Select role...</option>
            {roles.map((r) => (
              <option key={r.id} value={String(r.id)}>{r.name}</option>
            ))}
          </Select>
          {errors.roleId && <p className="text-xs text-destructive">{errors.roleId.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select {...register('status')}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create User'}
        </Button>
      </div>
    </form>
  );
}
