import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Shield, Users } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import api from '../../lib/api';
import RoleForm from './RoleForm';

export default function RolesPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editRole, setEditRole] = useState(null);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((r) => r.data),
  });

  const deleteRole = useMutation({
    mutationFn: (id) => api.delete(`/roles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
    onError: (err) => alert(err.response?.data?.message || 'Cannot delete role'),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Role Management</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Create and manage roles with custom permissions</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          Create Role
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p className="text-muted-foreground col-span-3 py-8 text-center">Loading...</p>
        ) : (
          roles.map((role) => (
            <div
              key={role.id}
              className="border rounded-lg p-5 bg-card hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{role.name}</h3>
                    {role.isSystem && (
                      <Badge variant="secondary" className="text-xs mt-0.5">System</Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditRole(role)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {!role.isSystem && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Delete role "${role.name}"?`)) deleteRole.mutate(role.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              {role.description && (
                <p className="text-xs text-muted-foreground mb-3">{role.description}</p>
              )}

              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                <Users className="w-3.5 h-3.5" />
                <span>{role._count?.users ?? 0} user{role._count?.users !== 1 ? 's' : ''}</span>
              </div>

              {/* Permission summary */}
              <div className="flex flex-wrap gap-1">
                {(() => {
                  const modules = [...new Set(role.rolePermissions?.map((rp) => rp.permission.module) || [])];
                  return modules.slice(0, 4).map((m) => (
                    <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                  ));
                })()}
                {(role.rolePermissions?.length || 0) === 0 && (
                  <span className="text-xs text-muted-foreground">No permissions assigned</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl" onClose={() => setShowCreate(false)}>
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
          </DialogHeader>
          <RoleForm
            onSuccess={() => {
              setShowCreate(false);
              queryClient.invalidateQueries({ queryKey: ['roles'] });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editRole} onOpenChange={(v) => !v && setEditRole(null)}>
        <DialogContent className="max-w-2xl" onClose={() => setEditRole(null)}>
          <DialogHeader>
            <DialogTitle>Edit Role: {editRole?.name}</DialogTitle>
          </DialogHeader>
          {editRole && (
            <RoleForm
              defaultValues={editRole}
              roleId={editRole.id}
              onSuccess={() => {
                setEditRole(null);
                queryClient.invalidateQueries({ queryKey: ['roles'] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
