import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  FolderKanban, MapPin, Calendar, User, Users, Clock,
  FileText, ChevronRight, Edit, Loader2, Plus, Trash2,
  ClipboardList, Camera, CheckSquare,
} from 'lucide-react';
import ProjectStatusBadge from '../../components/projects/ProjectStatusBadge';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import api from '../../lib/api';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TABS = ['Overview', 'Team', 'Visits', 'Work Logs', 'Reports', 'Timeline'];

const TASK_TYPE_LABELS = {
  CABLE_INSTALLATION: 'Cable Installation',
  PVC_INSTALLATION:   'PVC Installation',
  TESTING:            'Testing',
  COMMISSIONING:      'Commissioning',
  INSPECTION:         'Inspection',
  OTHER:              'Other',
};

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ project, onStatusChange }) {
  const STATUS_OPTIONS = ['PLANNING','ACTIVE','ON_HOLD','COMPLETED','CLOSED','CANCELLED'];
  const [status, setStatus] = useState(project.status);
  const [saving, setSaving] = useState(false);

  async function handleStatusChange(val) {
    setStatus(val);
    setSaving(true);
    try {
      await api.patch(`/projects/${project.id}/status`, { status: val });
      onStatusChange(val);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Info Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <InfoCard icon={Users} label="Client" value={project.client?.companyName} />
        <InfoCard icon={User}  label="Manager" value={project.manager?.fullName} />
        <InfoCard icon={MapPin} label="Location" value={[project.location, project.city].filter(Boolean).join(', ') || '—'} />
        <InfoCard icon={Calendar} label="Start Date" value={fmt(project.startDate)} />
        <InfoCard icon={Calendar} label="Est. End Date" value={fmt(project.estimatedEndDate)} />
        {project.completedAt && <InfoCard icon={Calendar} label="Completed" value={fmt(project.completedAt)} />}
        {project.sale && (
          <InfoCard icon={FileText} label="Linked Sale" value={project.sale.saleNumber} />
        )}
      </div>

      {/* Status Change */}
      <div className="border rounded-xl p-4 space-y-2">
        <p className="text-sm font-medium">Project Status</p>
        <div className="flex items-center gap-3">
          <Select value={status} onChange={(e) => handleStatusChange(e.target.value)} className="w-44">
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </Select>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* Notes */}
      {project.notes && (
        <div className="border rounded-xl p-4">
          <p className="text-sm font-medium mb-1">Notes</p>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{project.notes}</p>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Site Visits',     value: project._count.siteVisits },
          { label: 'Work Logs',       value: project._count.workLogs },
          { label: 'Service Reports', value: project._count.serviceReports },
        ].map((s) => (
          <div key={s.label} className="border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="border rounded-xl p-3 flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium mt-0.5">{value || '—'}</p>
      </div>
    </div>
  );
}

// ─── Team Tab ─────────────────────────────────────────────────────────────────

function TeamTab({ project, projectId }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd]     = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addRole,   setAddRole]   = useState('TECHNICIAN');
  const [adding,    setAdding]    = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ['users-simple'],
    queryFn:  () => api.get('/users?limit=500').then((r) => (Array.isArray(r.data) ? r.data : r.data.users || [])),
    enabled:  showAdd,
  });

  const assignedIds = new Set(project.assignments.map((a) => a.userId));
  const available   = users.filter((u) => !assignedIds.has(u.id));

  async function handleAdd() {
    if (!addUserId) return;
    setAdding(true);
    try {
      await api.post(`/projects/${projectId}/assignments`, {
        assignments: [{ userId: Number(addUserId), role: addRole }],
      });
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      setAddUserId('');
      setShowAdd(false);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(userId) {
    await api.delete(`/projects/${projectId}/assignments/${userId}`);
    qc.invalidateQueries({ queryKey: ['project', projectId] });
  }

  const ROLE_COLORS = {
    TEAM_LEADER: 'bg-blue-50 text-blue-700 border-blue-200',
    TECHNICIAN:  'bg-green-50 text-green-700 border-green-200',
    SUPERVISOR:  'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{project.assignments.length} team member{project.assignments.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-3.5 h-3.5" /> Add Member</Button>
      </div>

      {project.assignments.length === 0 && (
        <div className="text-center py-10 text-muted-foreground border rounded-xl">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No team members assigned yet</p>
        </div>
      )}

      <div className="divide-y border rounded-xl overflow-hidden">
        {project.assignments.map((a) => (
          <div key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {a.user.fullName.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium">{a.user.fullName}</p>
                <p className="text-xs text-muted-foreground">{a.user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${ROLE_COLORS[a.role] || ''}`}>
                {a.role.replace('_', ' ')}
              </span>
              <Button
                size="sm" variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => handleRemove(a.userId)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="border rounded-xl p-4 space-y-3 bg-muted/10">
          <p className="text-sm font-medium">Add Team Member</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">User</p>
              <Select value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
                <option value="">Select user…</option>
                {available.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Role</p>
              <Select value={addRole} onChange={(e) => setAddRole(e.target.value)}>
                <option value="TECHNICIAN">Technician</option>
                <option value="TEAM_LEADER">Team Leader</option>
                <option value="SUPERVISOR">Supervisor</option>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!addUserId || adding}>
              {adding && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Visits Tab ───────────────────────────────────────────────────────────────

function VisitsTab({ projectId }) {
  const { data: visits = [], isLoading, refetch } = useQuery({
    queryKey: ['project-visits', projectId],
    queryFn:  () => api.get(`/projects/${projectId}/visits`).then((r) => r.data),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{visits.length} site visit{visits.length !== 1 ? 's' : ''}</p>
        <Link to={`/projects/${projectId}/visits/new`}>
          <Button size="sm"><Plus className="w-3.5 h-3.5" /> Log Visit</Button>
        </Link>
      </div>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
      {!isLoading && visits.length === 0 && (
        <div className="text-center py-10 text-muted-foreground border rounded-xl">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No site visits logged yet</p>
        </div>
      )}

      <div className="space-y-3">
        {visits.map((v) => (
          <div key={v.id} className="border rounded-xl p-4 space-y-2 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">{fmt(v.visitDate)}</p>
                <p className="text-xs text-muted-foreground">Visited by {v.visitor?.fullName}</p>
              </div>
              <Link to={`/projects/${projectId}/visits/${v.id}`}>
                <Button size="sm" variant="outline">View</Button>
              </Link>
            </div>
            {v.purpose && <p className="text-sm"><span className="text-muted-foreground">Purpose:</span> {v.purpose}</p>}
            {v.observations && <p className="text-sm text-muted-foreground line-clamp-2">{v.observations}</p>}
            {v.photos.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Camera className="w-3.5 h-3.5" /> {v.photos.length} photo{v.photos.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Work Logs Tab ────────────────────────────────────────────────────────────

function WorkLogsTab({ projectId }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['project-work-logs', projectId],
    queryFn:  () => api.get(`/projects/${projectId}/work-logs`).then((r) => r.data),
  });

  const totalHours = logs.reduce((s, l) => s + l.hoursWorked, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{logs.length} work log{logs.length !== 1 ? 's' : ''}</p>
          {totalHours > 0 && <p className="text-xs text-muted-foreground">{totalHours.toFixed(1)} total hours</p>}
        </div>
        <Link to={`/projects/${projectId}/work-logs/new`}>
          <Button size="sm"><Plus className="w-3.5 h-3.5" /> Add Work Log</Button>
        </Link>
      </div>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
      {!isLoading && logs.length === 0 && (
        <div className="text-center py-10 text-muted-foreground border rounded-xl">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No work logs recorded yet</p>
        </div>
      )}

      <div className="space-y-3">
        {logs.map((l) => (
          <div key={l.id} className="border rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold">{fmt(l.logDate)}</p>
                <p className="text-xs text-muted-foreground">{l.user?.fullName} · {l.hoursWorked}h</p>
              </div>
              <Link to={`/projects/${projectId}/work-logs/${l.id}`}>
                <Button size="sm" variant="outline">View</Button>
              </Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {l.items.slice(0, 4).map((item, i) => (
                <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                  {TASK_TYPE_LABELS[item.taskType] || item.taskType}
                </span>
              ))}
              {l.items.length > 4 && (
                <span className="text-xs text-muted-foreground">+{l.items.length - 4} more</span>
              )}
            </div>
            {l.photos.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Camera className="w-3.5 h-3.5" /> {l.photos.length} photo{l.photos.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab({ projectId }) {
  const qc = useQueryClient();
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['project-reports', projectId],
    queryFn:  () => api.get(`/projects/${projectId}/reports`).then((r) => r.data),
  });

  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      await api.post(`/projects/${projectId}/reports`, { autoPopulate: true });
      qc.invalidateQueries({ queryKey: ['project-reports', projectId] });
    } finally {
      setCreating(false);
    }
  }

  const STATUS_COLORS = {
    DRAFT:              'bg-gray-50   text-gray-700',
    PENDING_SIGNATURES: 'bg-yellow-50 text-yellow-700',
    APPROVED:           'bg-green-50  text-green-700',
    REJECTED:           'bg-red-50    text-red-700',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{reports.length} service report{reports.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={handleCreate} disabled={creating}>
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Generate Report
        </Button>
      </div>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
      {!isLoading && reports.length === 0 && (
        <div className="text-center py-10 text-muted-foreground border rounded-xl">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No service reports yet. Generate one when work is complete.</p>
        </div>
      )}

      <div className="space-y-3">
        {reports.map((r) => (
          <div key={r.id} className="border rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold font-mono">{r.reportNumber}</p>
                <p className="text-xs text-muted-foreground">Generated by {r.generatedByUser?.fullName} · {fmt(r.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || ''}`}>
                  {r.status.replace('_', ' ')}
                </span>
                <Link to={`/projects/${projectId}/reports/${r.id}`}>
                  <Button size="sm" variant="outline">Open</Button>
                </Link>
              </div>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>{r.activities.length} activities</span>
              {r.clientSignedAt  && <span className="text-green-600">✓ Client signed</span>}
              {r.managerSignedAt && <span className="text-green-600">✓ Manager signed</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────

function TimelineTab({ projectId }) {
  const { data: timeline = [], isLoading } = useQuery({
    queryKey: ['project-timeline', projectId],
    queryFn:  () => api.get(`/projects/${projectId}/timeline`).then((r) => r.data),
  });

  const TYPE_CONFIG = {
    SITE_VISIT:     { icon: MapPin,       color: 'bg-blue-100 text-blue-600',   label: 'Site Visit' },
    WORK_LOG:       { icon: ClipboardList,color: 'bg-green-100 text-green-600', label: 'Work Log'   },
    SERVICE_REPORT: { icon: FileText,     color: 'bg-purple-100 text-purple-600',label: 'Report'    },
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (timeline.length === 0) return (
    <div className="text-center py-10 text-muted-foreground border rounded-xl">
      <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
      <p>No activity recorded yet</p>
    </div>
  );

  return (
    <div className="relative space-y-0">
      <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
      {timeline.map((event, i) => {
        const cfg   = TYPE_CONFIG[event.type] || TYPE_CONFIG.SITE_VISIT;
        const Icon  = cfg.icon;
        const d     = event.data;
        return (
          <div key={i} className="relative pl-14 pb-6">
            <div className={`absolute left-3 top-1 w-6 h-6 rounded-full flex items-center justify-center ${cfg.color}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="border rounded-xl p-3 bg-background">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{cfg.label}</span>
                <span className="text-xs text-muted-foreground">{fmtTime(event.date)}</span>
              </div>
              {event.type === 'SITE_VISIT' && (
                <p className="text-sm mt-1">{d.purpose || 'Site visit'} — by {d.visitor?.fullName}</p>
              )}
              {event.type === 'WORK_LOG' && (
                <p className="text-sm mt-1">{d.hoursWorked}h logged by {d.user?.fullName} · {d.items?.length} task{d.items?.length !== 1 ? 's' : ''}</p>
              )}
              {event.type === 'SERVICE_REPORT' && (
                <p className="text-sm mt-1 font-mono">{d.reportNumber} — {d.status?.replace('_', ' ')}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams();
  const projectId = Number(id);
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('Overview');

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', projectId],
    queryFn:  () => api.get(`/projects/${projectId}`).then((r) => r.data),
  });

  if (isLoading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (error || !project) return (
    <div className="p-6 text-center text-muted-foreground">Project not found.</div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link to="/projects" className="hover:underline">Projects</Link>
            <ChevronRight className="w-3 h-3" />
            <span className="font-mono">{project.projectNumber}</span>
          </div>
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{project.client?.companyName}</p>
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'Overview'  && (
          <OverviewTab
            project={project}
            onStatusChange={(s) => qc.setQueryData(['project', projectId], (old) => ({ ...old, status: s }))}
          />
        )}
        {activeTab === 'Team'      && <TeamTab project={project} projectId={projectId} />}
        {activeTab === 'Visits'    && <VisitsTab projectId={projectId} />}
        {activeTab === 'Work Logs' && <WorkLogsTab projectId={projectId} />}
        {activeTab === 'Reports'   && <ReportsTab projectId={projectId} />}
        {activeTab === 'Timeline'  && <TimelineTab projectId={projectId} />}
      </div>
    </div>
  );
}
