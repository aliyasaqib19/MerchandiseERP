import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FolderKanban, Plus, Search, MapPin, Calendar,
  Users, Loader2, User,
} from 'lucide-react';
import { StatsCard } from '../../components/dashboard/StatsCard';
import ProjectStatusBadge from '../../components/projects/ProjectStatusBadge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import api from '../../lib/api';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const createSchema = z.object({
  title:           z.string().min(1, 'Title is required'),
  clientId:        z.coerce.number().min(1, 'Client is required'),
  managerId:       z.coerce.number().min(1, 'Manager is required'),
  saleId:          z.coerce.number().optional().or(z.literal('')),
  location:        z.string().optional(),
  address:         z.string().optional(),
  city:            z.string().optional(),
  startDate:       z.string().optional(),
  estimatedEndDate:z.string().optional(),
  notes:           z.string().optional(),
}).refine((d) => {
  if (d.estimatedEndDate && d.startDate && d.estimatedEndDate < d.startDate) return false;
  return true;
}, { message: 'End date must be on or after start date', path: ['estimatedEndDate'] });

function CreateProjectDialog({ open, onClose, onCreated }) {
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-simple'],
    queryFn: () => api.get('/clients?limit=500').then((r) => (Array.isArray(r.data) ? r.data : r.data.clients || [])),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['users-simple'],
    queryFn: () => api.get('/users?limit=500').then((r) => (Array.isArray(r.data) ? r.data : r.data.users || [])),
  });

  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(createSchema),
  });

  async function onSubmit(values) {
    try {
      const payload = { ...values };
      if (!payload.saleId) delete payload.saleId;
      const res = await api.post('/projects', payload);
      reset();
      onCreated(res.data);
    } catch (err) {
      setError('root', { message: err.response?.data?.message || 'Failed to create project' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent onClose={onClose} className="max-w-2xl">
        <DialogHeader><DialogTitle>New Project</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {errors.root && (
            <div className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {errors.root.message}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Project Title *</Label>
              <Input placeholder="e.g. Network Installation – HQ" {...register('title')} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Select {...register('clientId')}>
                <option value="">Select client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}
              </Select>
              {errors.clientId && <p className="text-xs text-destructive">{errors.clientId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Project Manager *</Label>
              <Select {...register('managerId')}>
                <option value="">Select manager…</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </Select>
              {errors.managerId && <p className="text-xs text-destructive">{errors.managerId.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Linked Sale (optional)</Label>
              <Input type="number" placeholder="Sale ID" {...register('saleId')} />
            </div>

            <div className="space-y-1.5">
              <Label>Location / Site Name</Label>
              <Input placeholder="Building A, Floor 3" {...register('location')} />
            </div>

            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input placeholder="123 Main St" {...register('address')} />
            </div>

            <div className="space-y-1.5">
              <Label>City</Label>
              <Input placeholder="Dubai" {...register('city')} />
            </div>

            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" {...register('startDate')} />
            </div>

            <div className="space-y-1.5">
              <Label>Estimated End Date</Label>
              <Input type="date" {...register('estimatedEndDate')} />
              {errors.estimatedEndDate && <p className="text-xs text-destructive">{errors.estimatedEndDate.message}</p>}
            </div>

            <div className="col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <textarea
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Additional notes…"
                {...register('notes')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const STATUS_FILTERS = ['', 'PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CLOSED', 'CANCELLED'];
const STATUS_LABELS  = { '': 'All', PLANNING:'Planning', ACTIVE:'Active', ON_HOLD:'On Hold', COMPLETED:'Completed', CLOSED:'Closed', CANCELLED:'Cancelled' };

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search,     setSearch]     = useState('');
  const [status,     setStatus]     = useState('');
  const [page,       setPage]       = useState(1);

  const { data: stats } = useQuery({
    queryKey: ['project-stats'],
    queryFn:  () => api.get('/projects/stats').then((r) => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['projects', page, search, status],
    queryFn: () => {
      const params = new URLSearchParams({ page, limit: 30 });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      return api.get(`/projects?${params}`).then((r) => r.data);
    },
    keepPreviousData: true,
  });

  const projects = data?.projects || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderKanban className="w-6 h-6" /> Projects
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage installations and field work</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Project
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { label: 'Total',     value: stats.total,     color: 'blue'   },
            { label: 'Planning',  value: stats.planning,  color: 'purple' },
            { label: 'Active',    value: stats.active,    color: 'green'  },
            { label: 'On Hold',   value: stats.onHold,    color: 'yellow' },
            { label: 'Completed', value: stats.completed, color: 'teal'   },
            { label: 'Closed',    value: stats.closed,    color: 'gray'   },
          ].map((s) => (
            <div
              key={s.label}
              onClick={() => setStatus(s.label === 'Total' ? '' : s.label.toUpperCase().replace(' ', '_'))}
              className="border rounded-xl p-3 cursor-pointer hover:shadow-md transition-shadow bg-muted/20 hover:bg-background"
            >
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                status === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:border-primary/50'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Project Cards Grid */}
      {isLoading && (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      )}
      {!isLoading && projects.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <FolderKanban className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No projects found</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`}>
            <div className="border rounded-xl p-4 hover:shadow-md transition-all hover:border-primary/40 space-y-3 bg-background h-full">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-mono text-muted-foreground">{p.projectNumber}</p>
                  <h3 className="font-semibold leading-tight mt-0.5">{p.title}</h3>
                </div>
                <ProjectStatusBadge status={p.status} />
              </div>

              <div className="space-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{p.client?.companyName}</span>
                </div>
                {(p.location || p.city) && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{[p.location, p.city].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {(p.startDate || p.estimatedEndDate) && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {fmtDate(p.startDate)} {p.estimatedEndDate ? `→ ${fmtDate(p.estimatedEndDate)}` : ''}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span>{p.manager?.fullName}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground border-t">
                <span>{p._count.siteVisits} visit{p._count.siteVisits !== 1 ? 's' : ''}</span>
                <span>{p._count.workLogs} log{p._count.workLogs !== 1 ? 's' : ''}</span>
                <span>{p._count.serviceReports} report{p._count.serviceReports !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {data.page} of {data.pages} · {data.total} projects</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
            <Button variant="outline" size="sm" disabled={data.page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <CreateProjectDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(proj) => {
          setShowCreate(false);
          qc.invalidateQueries({ queryKey: ['projects'] });
          qc.invalidateQueries({ queryKey: ['project-stats'] });
        }}
      />
    </div>
  );
}
