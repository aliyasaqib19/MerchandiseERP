import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CheckCircle, XCircle, Clock, AlertTriangle, Plus, ChevronDown,
  Loader2, FileText, RefreshCw, Pencil,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

const TYPES = [
  'QUOTATION','PURCHASE_ORDER','PAYMENT','INVENTORY_ADJUSTMENT',
  'PROJECT_CLOSURE','USER_CREATION','ROLE_CHANGE','DOCUMENT','OTHER',
];
const PRIORITY_CFG = {
  LOW:    { cls: 'bg-gray-100 text-gray-600',   label: 'Low'    },
  NORMAL: { cls: 'bg-blue-50 text-blue-700',    label: 'Normal' },
  HIGH:   { cls: 'bg-amber-50 text-amber-700',  label: 'High'   },
  URGENT: { cls: 'bg-red-50 text-red-700',      label: 'Urgent' },
};
const STATUS_CFG = {
  PENDING:   { cls: 'bg-amber-50 text-amber-700',  icon: Clock,       label: 'Pending'   },
  APPROVED:  { cls: 'bg-green-50 text-green-700',  icon: CheckCircle, label: 'Approved'  },
  REJECTED:  { cls: 'bg-red-50 text-red-700',      icon: XCircle,     label: 'Rejected'  },
  CANCELLED: { cls: 'bg-gray-50 text-gray-500',    icon: XCircle,     label: 'Cancelled' },
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const createSchema = z.object({
  type:        z.string().min(1),
  title:       z.string().min(2, 'Title required'),
  description: z.string().optional(),
  priority:    z.string().default('NORMAL'),
  dueDate:     z.string().optional(),
});

function CreateDialog({ onCreated, onClose }) {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(createSchema),
    defaultValues: { type: 'OTHER', priority: 'NORMAL' },
  });

  async function onSubmit(values) {
    try {
      await api.post('/approvals', values);
      onCreated();
      onClose();
    } catch (err) {
      setError('root', { message: err.response?.data?.message || 'Something went wrong' });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold">New Approval Request</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root && (
            <div className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {errors.root.message}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Type *</Label>
            <Select {...register('type')}>
              {TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input placeholder="Approval request title" {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" {...register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select {...register('priority')}>
                {Object.keys(PRIORITY_CFG).map((p) => <option key={p} value={p}>{PRIORITY_CFG[p].label}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" {...register('dueDate')} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Submit
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditDialog({ item, onDone, onClose }) {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(createSchema),
    defaultValues: {
      type: item.type,
      title: item.title,
      description: item.description || '',
      priority: item.priority,
      dueDate: item.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : '',
    },
  });

  async function onSubmit(values) {
    try {
      await api.put(`/approvals/${item.id}`, { ...values, resubmit: true });
      onDone();
      onClose();
    } catch (err) {
      setError('root', { message: err.response?.data?.message || 'Something went wrong' });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold">Edit & Resubmit Request</h2>
        <p className="text-xs text-muted-foreground -mt-2">Saving will send this request back for approval (status → Pending).</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root && (
            <div className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive">
              {errors.root.message}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Type *</Label>
            <Select {...register('type')}>
              {TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input placeholder="Approval request title" {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" {...register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select {...register('priority')}>
                {Object.keys(PRIORITY_CFG).map((p) => <option key={p} value={p}>{PRIORITY_CFG[p].label}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" {...register('dueDate')} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Save & Resubmit
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DecideDialog({ item, preset, onDone, onClose }) {
  const [decision, setDecision] = useState(preset || 'APPROVED');
  const [note, setNote]         = useState('');
  const [saving, setSaving]     = useState(false);

  async function submit() {
    setSaving(true);
    try {
      // Shipment-linked approvals must act on the shipment itself (stock + sync)
      if (item.referenceType === 'Shipment' && item.referenceId) {
        const verb = decision === 'APPROVED' ? 'approve' : 'reject';
        await api.post(`/shipments/${item.referenceId}/${verb}`, { note });
      } else {
        await api.post(`/approvals/${item.id}/decide`, { decision, decisionNote: note });
      }
      onDone();
      onClose();
    } catch (e) {
      alert(e?.response?.data?.message || 'Action failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold">Decide: {item.title}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setDecision('APPROVED')}
            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${decision === 'APPROVED' ? 'bg-green-600 text-white border-green-600' : 'border-border'}`}
          >
            Approve
          </button>
          <button
            onClick={() => setDecision('REJECTED')}
            className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${decision === 'REJECTED' ? 'bg-red-600 text-white border-red-600' : 'border-border'}`}
          >
            Reject
          </button>
        </div>
        <div className="space-y-1.5">
          <Label>Decision Note (optional)</Label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Add a note for the requester…"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className={decision === 'APPROVED' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {decision === 'APPROVED' ? 'Approve' : 'Reject'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canApproveShipments = hasPermission('SHIPMENTS_APPROVE');
  const canApproveGeneric = hasPermission('APPROVALS_APPROVE');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [showCreate, setShowCreate] = useState(false);
  const [deciding, setDeciding]     = useState(null); // { item, decision }
  const [editing, setEditing]       = useState(null);
  const [mine, setMine]             = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['approvals', statusFilter, mine],
    queryFn: () => api.get('/approvals', { params: { status: statusFilter || undefined, mine: mine ? 'true' : undefined, limit: 50 } }).then((r) => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['approval-stats'],
    queryFn: () => api.get('/approvals/stats').then((r) => r.data),
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['approvals'] });
    qc.invalidateQueries({ queryKey: ['approval-stats'] });
  }

  const statCards = [
    { label: 'Pending',  value: stats?.pending  || 0, cls: 'text-amber-600',  icon: Clock       },
    { label: 'Approved', value: stats?.approved || 0, cls: 'text-green-600',  icon: CheckCircle },
    { label: 'Rejected', value: stats?.rejected || 0, cls: 'text-red-600',    icon: XCircle     },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Approval Workflows</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Review and manage approval requests across all modules</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> New Request
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-white border rounded-xl p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Icon className={`w-5 h-5 ${c.cls}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-sm text-muted-foreground">{c.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}
          >
            {s || 'All'}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="rounded" />
            My requests only
          </label>
          <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : !data?.items?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No approval requests found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Requested By</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((item) => {
                const sc = STATUS_CFG[item.status] || STATUS_CFG.PENDING;
                const pc = PRIORITY_CFG[item.priority] || PRIORITY_CFG.NORMAL;
                const StatusIcon = sc.icon;
                return (
                  <tr key={item.id} className="hover:bg-muted/10">
                    <td className="px-4 py-3 font-medium">
                      {item.title}
                      {item.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pc.cls}`}>{pc.label}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.requester?.fullName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${sc.cls}`}>
                        <StatusIcon className="w-3 h-3" /> {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmt(item.dueDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {item.status === 'PENDING' && (() => {
                          const isShipment = item.referenceType === 'Shipment';
                          const allowed = isShipment ? canApproveShipments : canApproveGeneric;
                          if (!allowed) {
                            return <span className="text-xs text-muted-foreground">{isShipment ? 'Boss approval required' : 'Awaiting approval'}</span>;
                          }
                          return (
                            <>
                              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setDeciding({ item, decision: 'APPROVED' })}>
                                <CheckCircle className="w-3.5 h-3.5" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setDeciding({ item, decision: 'REJECTED' })}>
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </Button>
                            </>
                          );
                        })()}
                        {(item.status === 'REJECTED' || item.status === 'CANCELLED') && (
                          <Button size="sm" variant="outline" onClick={() => setEditing(item)}>
                            <Pencil className="w-3.5 h-3.5" /> Edit & Resubmit
                          </Button>
                        )}
                      </div>
                      {item.status !== 'PENDING' && item.decider && (
                        <span className="text-xs text-muted-foreground">By {item.decider.fullName}</span>
                      )}
                      {item.decisionNote && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">"{item.decisionNote}"</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && <CreateDialog onCreated={refresh} onClose={() => setShowCreate(false)} />}
      {deciding   && <DecideDialog item={deciding.item} preset={deciding.decision} onDone={refresh} onClose={() => setDeciding(null)} />}
      {editing    && <EditDialog item={editing} onDone={refresh} onClose={() => setEditing(null)} />}
    </div>
  );
}
