import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, ChevronRight, Loader2, Camera, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import api from '../../lib/api';

const TASK_TYPES = [
  { value: 'CABLE_INSTALLATION', label: 'Cable Installation' },
  { value: 'PVC_INSTALLATION',   label: 'PVC Installation'   },
  { value: 'TESTING',            label: 'Testing'             },
  { value: 'COMMISSIONING',      label: 'Commissioning'       },
  { value: 'INSPECTION',         label: 'Inspection'          },
  { value: 'OTHER',              label: 'Other'               },
];

const schema = z.object({
  logDate:    z.string().min(1, 'Date required'),
  hoursWorked:z.coerce.number().min(0),
  notes:      z.string().optional(),
  items: z.array(z.object({
    taskType:   z.string(),
    description:z.string().min(1, 'Description required'),
    quantity:   z.coerce.number().optional().or(z.literal('')),
    unit:       z.string().optional(),
    completed:  z.boolean().default(true),
  })).min(1, 'Add at least one task'),
});

function PhotoUploader({ photos, setPhotos }) {
  const fileRef = useRef();
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
    <div className="space-y-2">
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border bg-muted">
              <img src={p.url} alt={p.caption || 'photo'} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
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

export default function WorkLogPage() {
  const { projectId, logId } = useParams();
  const navigate = useNavigate();
  const isEdit   = !!logId && logId !== 'new';
  const today    = new Date().toISOString().split('T')[0];

  const { data: project } = useQuery({
    queryKey: ['project-basic', projectId],
    queryFn:  () => api.get(`/projects/${projectId}`).then((r) => r.data),
  });

  const { data: existing } = useQuery({
    queryKey: ['work-log', logId],
    queryFn:  () => api.get(`/work-logs/${logId}`).then((r) => r.data),
    enabled:  isEdit,
  });

  const { register, handleSubmit, control, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    values: isEdit && existing ? {
      logDate:    existing.logDate?.split('T')[0] || today,
      hoursWorked:existing.hoursWorked || 0,
      notes:      existing.notes || '',
      items:      existing.items || [{ taskType: 'OTHER', description: '', completed: true }],
    } : {
      logDate:    today,
      hoursWorked:0,
      notes:      '',
      items:      [{ taskType: 'OTHER', description: '', completed: true }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const [photos, setPhotos] = useState([]);

  async function onSubmit(values) {
    try {
      if (isEdit) {
        await api.put(`/work-logs/${logId}`, values);
        if (photos.length) await api.post(`/work-logs/${logId}/photos`, { photos });
      } else {
        await api.post(`/projects/${projectId}/work-logs`, { ...values, photos });
      }
      navigate(`/projects/${projectId}`);
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
        <span>{isEdit ? 'Edit Work Log' : 'New Work Log'}</span>
      </div>

      <h1 className="text-xl font-bold">{isEdit ? 'Edit Work Log' : 'Record Work Log'}</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 border rounded-xl p-5">
        {errors.root && (
          <div className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            {errors.root.message}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Date *</Label>
            <Input type="date" {...register('logDate')} />
            {errors.logDate && <p className="text-xs text-destructive">{errors.logDate.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Hours Worked</Label>
            <Input type="number" min="0" step="0.5" placeholder="8.0" {...register('hoursWorked')} />
          </div>
        </div>

        {/* Task Items */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Tasks Completed *</Label>
            <Button
              type="button" size="sm" variant="outline"
              onClick={() => append({ taskType: 'OTHER', description: '', completed: true })}
            >
              <Plus className="w-3.5 h-3.5" /> Add Task
            </Button>
          </div>
          {errors.items?.message && <p className="text-xs text-destructive">{errors.items.message}</p>}

          <div className="space-y-2">
            {fields.map((field, i) => (
              <div key={field.id} className="border rounded-lg p-3 space-y-2 bg-muted/10">
                <div className="flex items-start gap-2">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Task Type</p>
                      <Select {...register(`items.${i}.taskType`)}>
                        {TASK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </Select>
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <p className="text-xs text-muted-foreground">Description *</p>
                      <Input
                        placeholder="What was done…"
                        {...register(`items.${i}.description`)}
                      />
                      {errors.items?.[i]?.description && (
                        <p className="text-xs text-destructive">{errors.items[i].description.message}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="text-destructive hover:bg-destructive/10 p-1.5 rounded mt-5"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Quantity</p>
                    <Input type="number" min="0" step="any" placeholder="—" {...register(`items.${i}.quantity`)} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Unit</p>
                    <Input placeholder="m, pcs, roll" {...register(`items.${i}.unit`)} />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input type="checkbox" {...register(`items.${i}.completed`)} className="rounded" />
                      Completed
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Notes</Label>
          <textarea
            rows={2}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Additional notes for the day…"
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
            {isEdit ? 'Save Changes' : 'Save Work Log'}
          </Button>
        </div>
      </form>
    </div>
  );
}
