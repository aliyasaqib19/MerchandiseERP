import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Building2, Users, DollarSign, TrendingUp,
  Phone, Mail, ChevronRight,
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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

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
            {stats?.newThisMonth ? `${stats.newThisMonth} new client${stats.newThisMonth > 1 ? 's' : ''} this month` : 'Manage your client relationships'}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> Add Client
        </Button>
      </div>

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
