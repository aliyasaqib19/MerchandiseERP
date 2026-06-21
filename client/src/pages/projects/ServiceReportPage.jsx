import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FileText, ChevronRight, Loader2, Plus, Trash2,
  CheckCircle, XCircle, PenLine, Upload, AlertTriangle,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import api from '../../lib/api';

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const STATUS_CONFIG = {
  DRAFT:              { label: 'Draft',               cls: 'bg-gray-50   text-gray-700'   },
  PENDING_SIGNATURES: { label: 'Pending Signatures',  cls: 'bg-yellow-50 text-yellow-700' },
  APPROVED:           { label: 'Approved',            cls: 'bg-green-50  text-green-700'  },
  REJECTED:           { label: 'Rejected',            cls: 'bg-red-50    text-red-700'    },
};

// ─── Signature Upload Panel ───────────────────────────────────────────────────

function SignaturePanel({ report, onUpdated }) {
  const fileRef  = useRef();
  const [type,   setType]   = useState('client');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      setSaving(true);
      try {
        const res = await api.post(`/reports/${report.id}/signature`, {
          signatureType: type,
          signatureUrl:  reader.result,
        });
        onUpdated(res.data);
      } finally {
        setSaving(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleApprove() {
    setApproving(true);
    try {
      const res = await api.post(`/reports/${report.id}/approve`);
      onUpdated(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not approve');
    } finally {
      setApproving(false);
    }
  }

  const canApprove = report.clientSignatureUrl && report.managerSignatureUrl && report.status !== 'APPROVED';

  return (
    <div className="border rounded-xl p-5 space-y-4">
      <h3 className="font-semibold">Signatures</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Client Signature */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Client Signature</p>
          {report.clientSignatureUrl ? (
            <div className="space-y-1">
              <img
                src={report.clientSignatureUrl}
                alt="Client signature"
                className="border rounded-lg bg-white p-2 max-h-24 object-contain"
              />
              <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Signed {fmt(report.clientSignedAt)}
              </p>
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground">
              Not yet signed
            </div>
          )}
        </div>

        {/* Manager Signature */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Regional Manager Signature</p>
          {report.managerSignatureUrl ? (
            <div className="space-y-1">
              <img
                src={report.managerSignatureUrl}
                alt="Manager signature"
                className="border rounded-lg bg-white p-2 max-h-24 object-contain"
              />
              <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Signed {fmt(report.managerSignedAt)}
              </p>
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground">
              Not yet signed
            </div>
          )}
        </div>
      </div>

      {report.status !== 'APPROVED' && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Upload signature for</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('client')}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${type === 'client' ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
              >
                Client
              </button>
              <button
                type="button"
                onClick={() => setType('manager')}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${type === 'manager' ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
              >
                Manager
              </button>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Signature Image
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      )}

      {canApprove && (
        <div className="border-t pt-4 flex items-center gap-4">
          <div className="flex-1 text-sm text-muted-foreground">
            Both signatures collected. Approving this report will close the project.
          </div>
          <Button
            onClick={handleApprove}
            disabled={approving}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Approve & Close Project
          </Button>
        </div>
      )}

      {report.status === 'APPROVED' && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-2 text-green-700">
          <CheckCircle className="w-5 h-5" />
          <div>
            <p className="font-semibold text-sm">Report Approved</p>
            <p className="text-xs">{fmt(report.approvedAt)} — Project is now Closed</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Activity Editor ──────────────────────────────────────────────────────────

const editSchema = z.object({
  summary:        z.string().optional(),
  recommendations:z.string().optional(),
  activities: z.array(z.object({
    category:    z.string().min(1),
    description: z.string().min(1, 'Description required'),
    completedAt: z.string().optional(),
  })),
});

function ReportEditor({ report, onSaved }) {
  const [editing, setEditing] = useState(false);
  const { register, handleSubmit, control, formState: { isSubmitting } } = useForm({
    resolver: zodResolver(editSchema),
    values: {
      summary:        report.summary        || '',
      recommendations:report.recommendations|| '',
      activities:     report.activities.map((a) => ({
        category:    a.category,
        description: a.description,
        completedAt: a.completedAt ? new Date(a.completedAt).toISOString().split('T')[0] : '',
      })),
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'activities' });

  async function onSubmit(values) {
    const res = await api.put(`/reports/${report.id}`, values);
    onSaved(res.data);
    setEditing(false);
  }

  if (!editing) {
    return (
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        <PenLine className="w-3.5 h-3.5" /> Edit Report
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="border rounded-xl p-5 space-y-4 bg-muted/10">
      <p className="font-semibold text-sm">Edit Report</p>

      <div className="space-y-1.5">
        <Label>Summary</Label>
        <textarea rows={3} className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" {...register('summary')} />
      </div>
      <div className="space-y-1.5">
        <Label>Recommendations</Label>
        <textarea rows={2} className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" {...register('recommendations')} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Activities</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => append({ category: 'General', description: '', completedAt: '' })}>
            <Plus className="w-3.5 h-3.5" /> Add Row
          </Button>
        </div>
        {fields.map((f, i) => (
          <div key={f.id} className="grid grid-cols-12 gap-2 items-start">
            <div className="col-span-3">
              <Input placeholder="Category" {...register(`activities.${i}.category`)} />
            </div>
            <div className="col-span-6">
              <Input placeholder="Description" {...register(`activities.${i}.description`)} />
            </div>
            <div className="col-span-2">
              <Input type="date" {...register(`activities.${i}.completedAt`)} />
            </div>
            <button type="button" onClick={() => remove(i)} className="col-span-1 text-destructive p-1.5 hover:bg-destructive/10 rounded mt-0.5">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ServiceReportPage() {
  const { projectId, reportId } = useParams();
  const qc = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ['project-basic', projectId],
    queryFn:  () => api.get(`/projects/${projectId}`).then((r) => r.data),
  });

  const { data: report, isLoading, error } = useQuery({
    queryKey: ['service-report', reportId],
    queryFn:  () => api.get(`/reports/${reportId}`).then((r) => r.data),
  });

  function setReport(updated) {
    qc.setQueryData(['service-report', reportId], updated);
    qc.invalidateQueries({ queryKey: ['project-reports', Number(projectId)] });
    qc.invalidateQueries({ queryKey: ['project', Number(projectId)] });
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!report)  return <div className="p-6 text-center text-muted-foreground">Report not found.</div>;

  const { label: statusLabel, cls: statusCls } = STATUS_CONFIG[report.status] || {};

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/projects" className="hover:underline">Projects</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/projects/${projectId}`} className="hover:underline">{project?.projectNumber || projectId}</Link>
        <ChevronRight className="w-3 h-3" />
        <span>Service Report</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold font-mono">{report.reportNumber}</h1>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusCls}`}>{statusLabel}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {report.project?.title} — {report.project?.client?.companyName}
          </p>
          <p className="text-xs text-muted-foreground">Generated by {report.generatedByUser?.fullName} · {fmt(report.createdAt)}</p>
        </div>
        {report.status !== 'APPROVED' && (
          <ReportEditor report={report} onSaved={setReport} />
        )}
      </div>

      {/* Summary */}
      {(report.summary || report.recommendations) && (
        <div className="border rounded-xl p-5 space-y-4">
          {report.summary && (
            <div>
              <p className="text-sm font-semibold mb-1">Executive Summary</p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{report.summary}</p>
            </div>
          )}
          {report.recommendations && (
            <div>
              <p className="text-sm font-semibold mb-1">Recommendations</p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{report.recommendations}</p>
            </div>
          )}
        </div>
      )}

      {/* Activities Table */}
      <div className="border rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-muted/40 border-b">
          <h3 className="font-semibold text-sm">Completed Activities ({report.activities.length})</h3>
        </div>
        {report.activities.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground text-sm">No activities listed</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/20">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-1/4">Category</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Description</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-1/5">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {report.activities.map((a) => (
                <tr key={a.id} className="hover:bg-muted/10">
                  <td className="px-4 py-2.5 text-muted-foreground">{a.category}</td>
                  <td className="px-4 py-2.5">{a.description}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmt(a.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Signature Panel */}
      <SignaturePanel report={report} onUpdated={setReport} />

      {/* Project closure notice */}
      {report.status === 'APPROVED' && (
        <div className="border rounded-xl p-5 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-green-800">Project Closed</h3>
              <p className="text-sm text-green-700 mt-0.5">
                This service report has been approved and the project has been officially closed on {fmt(report.approvedAt)}.
                All work is complete and signed off by both client and regional manager.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
