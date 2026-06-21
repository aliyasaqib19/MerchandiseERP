import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Shield, Search, Loader2, Filter, RefreshCw,
  User, Database, FileText, ShoppingCart, Package, DollarSign, FolderKanban,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import api from '../../lib/api';

const MODULE_ICONS = {
  INVENTORY:     Package,
  CLIENTS:       User,
  SALES:         ShoppingCart,
  PROJECTS:      FolderKanban,
  FINANCE:       DollarSign,
  USERS:         User,
  ROLES:         Shield,
  DOCUMENTS:     FileText,
  APPROVALS:     Shield,
  DEFAULT:       Database,
};

const MODULE_COLORS = {
  INVENTORY:  'bg-blue-50   text-blue-700',
  CLIENTS:    'bg-purple-50 text-purple-700',
  SALES:      'bg-green-50  text-green-700',
  PROJECTS:   'bg-teal-50   text-teal-700',
  FINANCE:    'bg-amber-50  text-amber-700',
  USERS:      'bg-indigo-50 text-indigo-700',
  ROLES:      'bg-pink-50   text-pink-700',
  DEFAULT:    'bg-gray-50   text-gray-700',
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AuditPage() {
  const [page,   setPage]   = useState(1);
  const [module, setModule] = useState('');
  const [search, setSearch] = useState('');
  const [from,   setFrom]   = useState('');
  const [to,     setTo]     = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', page, module, search, from, to],
    queryFn: () => api.get('/audit', { params: {
      page, limit: 50,
      module: module || undefined,
      search: search || undefined,
      from: from   || undefined,
      to:   to     || undefined,
    }}).then((r) => r.data),
  });

  const { data: stats } = useQuery({
    queryKey: ['audit-stats'],
    queryFn:  () => api.get('/audit/stats').then((r) => r.data),
  });

  const totalPages = Math.ceil((data?.total || 0) / 50);
  const MODULES = ['INVENTORY', 'CLIENTS', 'SALES', 'PROJECTS', 'FINANCE', 'USERS', 'ROLES', 'APPROVALS', 'DOCUMENTS'];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> Audit Logs
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Complete system activity trail — {stats?.total?.toLocaleString() || 0} total records</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}><RefreshCw className="w-4 h-4" /> Refresh</Button>
      </div>

      {/* Module stats */}
      {stats?.byModule && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {stats.byModule.slice(0, 6).map((m) => {
            const Icon = MODULE_ICONS[m.module] || MODULE_ICONS.DEFAULT;
            const cls  = MODULE_COLORS[m.module] || MODULE_COLORS.DEFAULT;
            return (
              <button
                key={m.module}
                onClick={() => { setModule(m.module); setPage(1); }}
                className={`rounded-xl p-3 border text-left transition-all hover:shadow-sm ${module === m.module ? 'ring-2 ring-primary' : ''}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${cls}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-lg font-bold">{m._count.id}</p>
                <p className="text-xs text-muted-foreground">{m.module}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white border rounded-xl p-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search actions…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Select value={module} onChange={(e) => { setModule(e.target.value); setPage(1); }} className="w-40">
          <option value="">All Modules</option>
          {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>From</span>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-36" />
          <span>To</span>
          <Input type="date" value={to}   onChange={(e) => { setTo(e.target.value);   setPage(1); }} className="w-36" />
        </div>
        {(module || search || from || to) && (
          <Button variant="outline" size="sm" onClick={() => { setModule(''); setSearch(''); setFrom(''); setTo(''); setPage(1); }}>
            Clear Filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : !data?.items?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No audit records found</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Timestamp</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Module</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Resource</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.items.map((log) => {
                  const cls = MODULE_COLORS[log.module] || MODULE_COLORS.DEFAULT;
                  return (
                    <tr key={log.id} className="hover:bg-muted/10">
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">{fmt(log.createdAt)}</td>
                      <td className="px-4 py-2.5">
                        {log.user ? (
                          <span className="font-medium">{log.user.fullName}</span>
                        ) : (
                          <span className="text-muted-foreground italic">System</span>
                        )}
                        {log.user?.email && <p className="text-xs text-muted-foreground">{log.user.email}</p>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{log.module}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{log.action}</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {log.resourceType && <span>{log.resourceType}</span>}
                        {log.resourceId && <span className="ml-1 text-primary">#{log.resourceId}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{log.ipAddress || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} · {data.total} records
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
