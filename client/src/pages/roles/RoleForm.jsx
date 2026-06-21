import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import api from '../../lib/api';

const schema = z.object({
  name: z.string().min(2, 'Role name is required'),
  description: z.string().optional(),
});

const MODULE_LABELS = {
  INVENTORY: 'Inventory',
  CLIENTS: 'Clients',
  SALES: 'Sales',
  PROJECTS: 'Projects',
  FINANCE: 'Finance',
  USERS: 'Users',
  ROLES: 'Roles',
  SETTINGS: 'Settings',
};

export default function RoleForm({ onSuccess, defaultValues, roleId }) {
  const isEdit = !!roleId;

  const existingPermIds = new Set(
    defaultValues?.rolePermissions?.map((rp) => rp.permissionId) || []
  );
  const [selectedPerms, setSelectedPerms] = useState(new Set(existingPermIds));

  const { data: permData } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => api.get('/permissions').then((r) => r.data),
  });

  const grouped = permData?.grouped || {};

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name || '',
      description: defaultValues?.description || '',
    },
  });

  function togglePerm(id) {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleModule(modulePerms) {
    const allSelected = modulePerms.every((p) => selectedPerms.has(p.id));
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      modulePerms.forEach((p) => (allSelected ? next.delete(p.id) : next.add(p.id)));
      return next;
    });
  }

  async function onSubmit(values) {
    try {
      const payload = {
        ...values,
        permissionIds: Array.from(selectedPerms),
      };
      if (isEdit) {
        await api.put(`/roles/${roleId}`, payload);
      } else {
        await api.post('/roles', payload);
      }
      onSuccess?.();
    } catch (err) {
      setError('root', { message: err.response?.data?.message || 'Something went wrong' });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {errors.root && (
        <div className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive">
          {errors.root.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Role Name</Label>
          <Input placeholder="e.g. Warehouse Manager" {...register('name')} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input placeholder="Brief description..." {...register('description')} />
        </div>
      </div>

      {/* Permissions */}
      <div>
        <Label className="mb-3 block">Permissions</Label>
        <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
          {Object.entries(grouped).map(([module, perms]) => {
            const allSelected = perms.every((p) => selectedPerms.has(p.id));
            return (
              <div key={module} className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id={`mod-${module}`}
                    checked={allSelected}
                    onChange={() => toggleModule(perms)}
                    className="w-4 h-4 rounded text-primary"
                  />
                  <label htmlFor={`mod-${module}`} className="text-sm font-semibold cursor-pointer">
                    {MODULE_LABELS[module] || module}
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-1.5 pl-6">
                  {perms.map((perm) => (
                    <label key={perm.id} className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPerms.has(perm.id)}
                        onChange={() => togglePerm(perm.id)}
                        className="w-3.5 h-3.5 rounded text-primary"
                      />
                      {perm.displayName}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          {selectedPerms.size} permission{selectedPerms.size !== 1 ? 's' : ''} selected
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create Role'}
        </Button>
      </div>
    </form>
  );
}
