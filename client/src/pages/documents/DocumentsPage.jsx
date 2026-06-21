import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  FolderOpen, Upload, Search, FileText, File, Image, Archive,
  Loader2, Plus, Download, Trash2, Clock, Tag, RefreshCw,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select } from '../../components/ui/select';
import api from '../../lib/api';

const CATEGORIES = ['General', 'Contract', 'Technical', 'Financial', 'Legal', 'Project', 'Client', 'HR', 'Other'];

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime) {
  if (!mime) return FileText;
  if (mime.startsWith('image/')) return Image;
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar')) return Archive;
  return File;
}

const schema = z.object({
  title:       z.string().min(1, 'Title required'),
  description: z.string().optional(),
  category:    z.string().default('General'),
  tags:        z.string().optional(),
});

function UploadDialog({ onCreated, onClose }) {
  const fileRef = useRef();
  const [fileData, setFileData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { category: 'General' },
  });

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFileData({ url: reader.result, name: file.name, size: file.size, type: file.type });
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit(values) {
    if (!fileData) return alert('Please select a file');
    setUploading(true);
    try {
      await api.post('/documents', {
        ...values,
        fileUrl:  fileData.url,
        fileName: fileData.name,
        fileSize: fileData.size,
        mimeType: fileData.type,
      });
      onCreated();
      onClose();
    } finally { setUploading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <h2 className="text-lg font-bold">Upload Document</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* File picker */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
          >
            {fileData ? (
              <div className="space-y-1">
                <p className="font-medium text-sm">{fileData.name}</p>
                <p className="text-xs text-muted-foreground">{fmtSize(fileData.size)}</p>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to select file</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />

          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input placeholder="Document title" {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select {...register('category')}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tags</Label>
              <Input placeholder="comma, separated" {...register('tags')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea rows={2} className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" {...register('description')} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DocumentCard({ doc, onRefresh }) {
  const FileIcon = fileIcon(doc.mimeType);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm('Archive this document?')) return;
    setDeleting(true);
    await api.delete(`/documents/${doc.id}`).finally(() => setDeleting(false));
    onRefresh();
  }

  return (
    <div className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <FileIcon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{doc.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{doc.fileName}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{doc.category}</span>
        {doc.tags && doc.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
          <span key={t} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-0.5">
            <Tag className="w-2.5 h-2.5" />{t}
          </span>
        ))}
      </div>

      {doc.description && <p className="text-xs text-muted-foreground line-clamp-2">{doc.description}</p>}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmt(doc.createdAt)}</span>
        <span>v{doc.version} · {fmtSize(doc.fileSize)}</span>
      </div>

      <div className="flex gap-2 pt-1">
        <a href={doc.fileUrl} download={doc.fileName} className="flex-1">
          <Button variant="outline" size="sm" className="w-full">
            <Download className="w-3.5 h-3.5" /> Download
          </Button>
        </a>
        <Button variant="outline" size="sm" onClick={handleDelete} disabled={deleting} className="text-destructive hover:bg-destructive/10">
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [category,   setCategory]   = useState('');
  const [search,     setSearch]     = useState('');

  const { data: cats } = useQuery({
    queryKey: ['doc-categories'],
    queryFn:  () => api.get('/documents/categories').then((r) => r.data),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['documents', category, search],
    queryFn: () => api.get('/documents', { params: { category: category || undefined, search: search || undefined, limit: 100 } }).then((r) => r.data),
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['documents'] });
    qc.invalidateQueries({ queryKey: ['doc-categories'] });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Document Library</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Centralized document storage and version control</p>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Plus className="w-4 h-4" /> Upload Document
        </Button>
      </div>

      {/* Category summary */}
      {cats && cats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory('')}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${!category ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}
          >
            All ({data?.total || 0})
          </button>
          {cats.map((c) => (
            <button
              key={c.name}
              onClick={() => setCategory(c.name)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${category === c.name ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}
            >
              {c.name} ({c.count})
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search documents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : !data?.items?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No documents found</p>
          <p className="text-sm">Upload your first document to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {data.items.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onRefresh={refresh} />
          ))}
        </div>
      )}

      {showUpload && <UploadDialog onCreated={refresh} onClose={() => setShowUpload(false)} />}
    </div>
  );
}
