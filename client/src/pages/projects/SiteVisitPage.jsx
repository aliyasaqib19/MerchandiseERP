import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, ChevronRight, Loader2, Plus, Trash2, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import api from '../../lib/api';

const schema = z.object({
  visitDate:    z.string().min(1, 'Date required'),
  purpose:      z.string().optional(),
  requirements: z.string().optional(),
  observations: z.string().optional(),
  notes:        z.string().optional(),
});

function PhotoGrid({ photos, onRemove }) {
  if (!photos.length) return null;
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {photos.map((p, i) => (
        <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
          <img src={p.url} alt={p.caption || 'photo'} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          {p.caption && (
            <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-1.5 py-1 truncate">{p.caption}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function PhotoUploader({ photos, setPhotos }) {
  const fileRef    = useRef();
  const [cap, setCap] = useState('');

  function handleFiles(e) {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setPhotos((prev) => [...prev, { url: reader.result, caption: cap }]);
        setCap('');
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  return (
    <div className="space-y-3">
      <PhotoGrid photos={photos} onRemove={(i) => setPhotos((prev) => prev.filter((_, idx) => idx !== i))} />
      <div className="flex gap-2">
        <Input
          placeholder="Caption (optional)"
          value={cap}
          onChange={(e) => setCap(e.target.value)}
          className="flex-1"
        />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
          <Camera className="w-4 h-4" /> Upload
        </Button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
      </div>
    </div>
  );
}

export default function SiteVisitPage() {
  const { projectId, visitId } = useParams();
  const navigate = useNavigate();
  const isEdit   = !!visitId && visitId !== 'new';

  const { data: project } = useQuery({
    queryKey: ['project-basic', projectId],
    queryFn:  () => api.get(`/projects/${projectId}`).then((r) => r.data),
  });

  const { data: existing } = useQuery({
    queryKey: ['site-visit', visitId],
    queryFn:  () => api.get(`/visits/${visitId}`).then((r) => r.data),
    enabled:  isEdit,
  });

  const today = new Date().toISOString().split('T')[0];

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError, reset } = useForm({
    resolver: zodResolver(schema),
    values: isEdit && existing ? {
      visitDate:    existing.visitDate?.split('T')[0] || today,
      purpose:      existing.purpose      || '',
      requirements: existing.requirements || '',
      observations: existing.observations || '',
      notes:        existing.notes        || '',
    } : { visitDate: today },
  });

  const [photos, setPhotos] = useState([]);

  async function onSubmit(values) {
    try {
      if (isEdit) {
        await api.put(`/visits/${visitId}`, values);
        if (photos.length) await api.post(`/visits/${visitId}/photos`, { photos });
      } else {
        await api.post(`/projects/${projectId}/visits`, { ...values, photos });
      }
      navigate(`/projects/${projectId}`, { state: { tab: 'Visits' } });
    } catch (err) {
      setError('root', { message: err.response?.data?.message || 'Failed to save' });
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/projects" className="hover:underline">Projects</Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/projects/${projectId}`} className="hover:underline">{project?.projectNumber || projectId}</Link>
        <ChevronRight className="w-3 h-3" />
        <span>{isEdit ? 'Edit Visit' : 'New Site Visit'}</span>
      </div>

      <h1 className="text-xl font-bold">{isEdit ? 'Edit Site Visit' : 'Log Site Visit'}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 border rounded-xl p-5">
        {errors.root && (
          <div className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            {errors.root.message}
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Visit Date *</Label>
          <Input type="date" {...register('visitDate')} />
          {errors.visitDate && <p className="text-xs text-destructive">{errors.visitDate.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Purpose of Visit</Label>
          <Input placeholder="e.g. Initial site survey, cable routing inspection" {...register('purpose')} />
        </div>

        <div className="space-y-1.5">
          <Label>Requirements / Client Requests</Label>
          <textarea
            rows={3}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Document what the client requested or what needs to be done…"
            {...register('requirements')}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Observations</Label>
          <textarea
            rows={3}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Site conditions, issues found, existing infrastructure…"
            {...register('observations')}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Additional Notes</Label>
          <textarea
            rows={2}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Any other remarks…"
            {...register('notes')}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Photos</Label>
          <PhotoUploader photos={photos} setPhotos={setPhotos} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate(`/projects/${projectId}`)}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Log Visit'}
          </Button>
        </div>
      </form>
    </div>
  );
}
