import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import {
  Plus, Search, Building2, Users, DollarSign, TrendingUp,
  Phone, Mail, ChevronRight, Star, Upload, Download, Loader2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { StatsCard } from '../../components/dashboard/StatsCard';
import { ClientStatusBadge } from '../../components/clients/ClientStatusBadge';
import ClientForm from '../../components/clients/ClientForm';
import api from '../../lib/api';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n || 0);
}

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('clients'); // 'clients' | 'contacts'
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const contactFileRef = useRef(null);

  const { data: stats } = useQuery({
    queryKey: ['client-stats'],
    queryFn: () => api.get('/clients/stats').then((r) => r.data),
  });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients', { search, statusFilter, industryFilter }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search)         params.set('search', search);
      if (statusFilter)   params.set('status', statusFilter);
      if (industryFilter) params.set('industry', industryFilter);
      return api.get(`/clients?${params}`).then((r) => r.data);
    },
  });

  const { data: industries = [] } = useQuery({
    queryKey: ['client-industries'],
    queryFn: () => api.get('/clients/industries').then((r) => r.data),
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['all-contacts', contactSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      if (contactSearch) params.set('search', contactSearch);
      return api.get(`/clients/all-contacts?${params}`).then((r) => r.data);
    },
    enabled: tab === 'contacts',
  });

  const importContacts = useMutation({
    mutationFn: (rows) => api.post('/clients/contacts/import', { rows }).then((r) => r.data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['all-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['client-stats'] });
      alert(`Import complete:\n• ${res.created} contact(s) added\n• ${res.clientsCreated} new client(s) created\n• ${res.skipped} row(s) skipped`);
    },
    onError: (e) => alert(e?.response?.data?.message || 'Import failed'),
  });

  function handleContactFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (!rows.length) { alert('The sheet appears to be empty.'); return; }
        importContacts.mutate(rows);
      } catch {
        alert('Could not read the file. Please use the provided template.');
      } finally {
        if (contactFileRef.current) contactFileRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  }

  function downloadContactTemplate() {
    const ws = XLSX.utils.json_to_sheet([
      { name: 'Ahmed Al-Rashidi', client: 'Gulf Telecom Solutions', phone: '+971 50 111 2233' },
      { name: 'Fatima Al-Zaabi', client: 'Emirates Networks LLC', phone: '+971 52 500 6600' },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    XLSX.writeFile(wb, 'contacts-template.xlsx');
  }

  const STATS = [
    { label: 'Total Clients',     value: String(stats?.totalClients  ?? '—'), icon: Building2,  color: 'blue' },
    { label: 'Active Clients',    value: String(stats?.activeClients  ?? '—'), icon: Users,      color: 'green' },
    { label: 'Prospects',         value: String(stats?.prospects      ?? '—'), icon: TrendingUp, color: 'indigo' },
    { label: 'Outstanding Balance', value: fmt(stats?.outstanding),            icon: DollarSign, color: 'orange' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {tab === 'contacts'
              ? `${contacts.length} contact${contacts.length !== 1 ? 's' : ''} across all clients`
              : stats?.newThisMonth ? `${stats.newThisMonth} new client${stats.newThisMonth > 1 ? 's' : ''} this month` : 'Manage your client relationships'}
          </p>
        </div>
        {tab === 'clients' ? (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Add Client
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <input ref={contactFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleContactFile} />
            <Button variant="outline" onClick={downloadContactTemplate} title="Download a sample Excel template">
              <Download className="w-4 h-4" /> Template
            </Button>
            <Button onClick={() => contactFileRef.current?.click()} disabled={importContacts.isPending}>
              {importContacts.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload Excel
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { key: 'clients', label: 'All Clients', icon: Building2 },
          { key: 'contacts', label: 'Contacts', icon: Users },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'clients' && (<>
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATS.map((s) => <StatsCard key={s.label} {...s} />)}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search company, email, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="PROSPECT">Prospect</option>
          <option value="INACTIVE">Inactive</option>
          <option value="BLACKLISTED">Blacklisted</option>
        </Select>
        <Select value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)} className="w-48">
          <option value="">All Industries</option>
          {industries.map((i) => <option key={i} value={i}>{i}</option>)}
        </Select>
      </div>

      {/* Client Table */}
      <div className="border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Company</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Primary Contact</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Industry</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Location</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Outstanding</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No clients found</p>
                    <Button variant="outline" className="mt-3" onClick={() => setShowCreate(true)}>
                      <Plus className="w-4 h-4" /> Add your first client
                    </Button>
                  </td>
                </tr>
              ) : (
                clients.map((client) => {
                  const primary = client.contacts?.[0];
                  return (
                    <tr key={client.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {client.companyName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <Link to={`/clients/${client.id}`} className="font-semibold hover:text-primary transition-colors">
                              {client.companyName}
                            </Link>
                            {client.email && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Mail className="w-3 h-3" />{client.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {primary ? (
                          <div>
                            <p className="font-medium text-sm">{primary.fullName}</p>
                            <p className="text-xs text-muted-foreground">{primary.title}</p>
                            {primary.phone && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" />{primary.phone}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No contact</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {client.industry ? (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{client.industry}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {[client.city, client.country].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {client.outstandingBalance > 0 ? (
                          <span className="font-semibold text-orange-600">{fmt(client.outstandingBalance)}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">Clear</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ClientStatusBadge status={client.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/clients/${client.id}`}>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>)}

      {/* ── Contacts tab ── */}
      {tab === 'contacts' && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search contacts..." value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} />
          </div>

          {contactsLoading ? (
            <div className="text-center py-16 text-muted-foreground">Loading contacts...</div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-16 border rounded-xl">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">No contacts found</p>
              <p className="text-sm text-muted-foreground mt-1">Upload an Excel sheet (name, client, phone) or add contacts from a client page.</p>
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Title</th>
                    <th className="text-left px-4 py-3 font-medium">Client</th>
                    <th className="text-left px-4 py-3 font-medium">Phone</th>
                    <th className="text-left px-4 py-3 font-medium">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contacts.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">
                            {c.fullName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{c.fullName}</span>
                          {c.isPrimary && (
                            <span className="inline-flex items-center gap-1 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded-full">
                              <Star className="w-3 h-3" /> Primary
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.title || '—'}</td>
                      <td className="px-4 py-3">
                        {c.client ? (
                          <Link to={`/clients/${c.client.id}`} className="text-primary hover:underline font-medium">{c.client.companyName}</Link>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground"><Phone className="w-3 h-3" /> {c.phone}</a>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {c.email ? (
                          <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground"><Mail className="w-3 h-3" /> {c.email}</a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl" onClose={() => setShowCreate(false)}>
          <DialogHeader><DialogTitle>Add New Client</DialogTitle></DialogHeader>
          <ClientForm
            onSuccess={() => {
              setShowCreate(false);
              queryClient.invalidateQueries({ queryKey: ['clients'] });
              queryClient.invalidateQueries({ queryKey: ['client-stats'] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
