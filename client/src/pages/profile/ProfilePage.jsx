import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Lock, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';

const phoneRegex = /^\+?[\d\s\-().]{7,20}$/;
const passwordRegex = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;

const profileSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().regex(phoneRegex, 'Invalid phone number (e.g. +92 300 1234567)').optional().or(z.literal('')),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(passwordRegex, 'Must contain at least one uppercase letter and one special character'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

function SuccessBanner({ message }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
      <CheckCircle className="w-4 h-4 flex-shrink-0" />
      {message}
    </div>
  );
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const {
    register: regProfile,
    handleSubmit: handleProfile,
    setError: setProfileError,
    formState: { errors: profileErrors, isSubmitting: profileSubmitting },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: user?.fullName || '', phone: user?.phone || '' },
  });

  const {
    register: regPwd,
    handleSubmit: handlePwd,
    reset: resetPwd,
    setError: setPwdError,
    formState: { errors: pwdErrors, isSubmitting: pwdSubmitting },
  } = useForm({ resolver: zodResolver(passwordSchema) });

  async function onProfileSubmit(values) {
    try {
      setProfileSuccess(false);
      const { data } = await api.put('/auth/profile', values);
      setAuth({ ...user, fullName: data.fullName, phone: data.phone }, accessToken, refreshToken);
      setProfileSuccess(true);
    } catch (err) {
      setProfileError('root', { message: err.response?.data?.message || 'Failed to update profile' });
    }
  }

  async function onPasswordSubmit(values) {
    try {
      setPasswordSuccess(false);
      await api.put('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      resetPwd();
      setPasswordSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to change password';
      if (msg.toLowerCase().includes('current')) {
        setPwdError('currentPassword', { message: msg });
      } else {
        setPwdError('root', { message: msg });
      }
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account information and security settings</p>
      </div>

      {/* Profile Info */}
      <div className="bg-white border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white">
              {user?.fullName?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="font-semibold flex items-center gap-2"><User className="w-4 h-4" /> Profile Information</h2>
            <p className="text-xs text-muted-foreground">Update your display name and contact number</p>
          </div>
        </div>

        <form onSubmit={handleProfile(onProfileSubmit)} className="space-y-4">
          {profileErrors.root && (
            <div className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {profileErrors.root.message}
            </div>
          )}
          {profileSuccess && <SuccessBanner message="Profile updated successfully" />}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Full Name *</Label>
              <Input placeholder="Your full name" {...regProfile('fullName')} />
              {profileErrors.fullName && <p className="text-xs text-destructive">{profileErrors.fullName.message}</p>}
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Email <span className="text-muted-foreground text-xs">(cannot be changed)</span></Label>
              <Input value={user?.email || ''} disabled className="bg-muted/50" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Phone</Label>
              <Input placeholder="+92 300 1234567" {...regProfile('phone')} />
              {profileErrors.phone && <p className="text-xs text-destructive">{profileErrors.phone.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Role <span className="text-muted-foreground text-xs">(assigned by admin)</span></Label>
              <Input value={user?.role || ''} disabled className="bg-muted/50" />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={profileSubmitting}>
              {profileSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </div>

      {/* Change Password */}
      <div className="bg-white border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <div>
            <h2 className="font-semibold">Change Password</h2>
            <p className="text-xs text-muted-foreground">Min 8 characters, one uppercase letter, one special character</p>
          </div>
        </div>

        <form onSubmit={handlePwd(onPasswordSubmit)} className="space-y-4">
          {pwdErrors.root && (
            <div className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {pwdErrors.root.message}
            </div>
          )}
          {passwordSuccess && <SuccessBanner message="Password changed successfully" />}

          <div className="space-y-1.5">
            <Label>Current Password *</Label>
            <Input type="password" placeholder="••••••••" {...regPwd('currentPassword')} />
            {pwdErrors.currentPassword && <p className="text-xs text-destructive">{pwdErrors.currentPassword.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>New Password *</Label>
            <Input type="password" placeholder="••••••••" {...regPwd('newPassword')} />
            {pwdErrors.newPassword && <p className="text-xs text-destructive">{pwdErrors.newPassword.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Confirm New Password *</Label>
            <Input type="password" placeholder="••••••••" {...regPwd('confirmPassword')} />
            {pwdErrors.confirmPassword && <p className="text-xs text-destructive">{pwdErrors.confirmPassword.message}</p>}
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={pwdSubmitting}>
              {pwdSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Change Password
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
