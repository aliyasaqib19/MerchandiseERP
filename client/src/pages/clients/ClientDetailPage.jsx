import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Building2, Mail, Phone, Globe, MapPin,
  Edit2, Trash2, Plus, MoreVertical, FileText, CreditCard,
  Users, Activity, BookOpen, AlertCircle, Loader2,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ClientStatusBadge } from '../../components/clients/ClientStatusBadge';
import ClientForm from '../../components/clients/ClientForm';
import ContactForm from '../../components/clients/ContactForm';
import TransactionForm from '../../components/clients/TransactionForm';
import api from '../../lib/api';

const TABS = [
  { id: 'overview',  label: 'Overview',  icon: Building2 },
  { id: 'contacts',  label: 'Contacts',  icon: Users },
  { id: 'activity',  label: 'Activity',  icon: Activity },
  { id: 'ledger',    label: 'Ledger',    icon: BookOpen },
];

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(n || 0);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ─── Overview Tab ─── */
function OverviewTab({ client }) {
  const primary = client.contacts?.find((c) => c.isPrimary) || client.contacts?.[0];

  const infoRows = [
    { label: 'Industry',     value: client.industry   || '—' },
    { label: 'Website',      value: client.website    || '—' },
    { label: 'Phone',        value: client.phone      || '—' },
    { label: 'Mobile',       value: client.mobile     || '—' },
    { label: 'Email',        value: client.email      || '—' },
    { label: 'Tax / VAT',    value: client.taxNumber  || '—' },
    { label: 'Credit Limit', value: client.creditLimit != null ? fmt(client.creditLimit) : '—' },
    { label: 'Address',      value: [client.address, client.city, client.country].filter(Boolean).join(', ') || '—' },
    { label: 'Client Since', value: fmtDate(client.createdAt) },
    { label: 'Notes',        value: client.notes || '—' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 border rounded-xl p-5 space-y-3">
        <h3 className="font-semibold text-sm">Company Details</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {infoRows.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm font-medium mt-0.5 break-words">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="space-y-4">
        {primary && (
          <div className="border rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Users className="w-4 h-4" /> Primary Contact
            </h3>
            <div className="space-y-1.5">
              <p className="font-semibold">{primary.fullName}</p>
              {primary.title && <p className="text-xs text-muted-foreground">{primary.title}</p>}
              {primary.email && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> {primary.email}
                </p>
              )}
              {primary.phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Phone className="w-3 h-3" /> {primary.phone}
                </p>
              )}
              {primary.mobile && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Phone className="w-3 h-3" /> {primary.mobile}
                </p>
              )}
            </div>
          </div>
        )}
        <div className="border rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Account Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Outstanding Balance</span>
              <span className={`font-bold ${(client.outstandingBalance || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {fmt(client.outstandingBalance)}
              </span>
            </div>
            {client.creditLimit != null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Credit Limit</span>
                <span className="font-medium">{fmt(client.creditLimit)}</span>
              </div>
            )}
            <Link to={`/clients/${client.id}/ledger`}>
              <Button variant="outline" className="w-full mt-2 text-xs">
                <BookOpen className="w-3.5 h-3.5" /> View Full Ledger
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Contacts Tab ─── */
function ContactsTab({ client }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const addMutation = useMutation({
    mutationFn: (data) => api.post(`/clients/${client.id}/contacts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', client.id] });
      setShowAdd(false);
    },
  });

  const editMutation = useMutation({
    mutationFn: (data) => api.put(`/clients/${client.id}/contacts/${editing.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', client.id] });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/clients/${client.id}/contacts/${deleting.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', client.id] });
      setDeleting(null);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{client.contacts?.length || 0} contact(s)</p>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4" /> Add Contact
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {client.contacts?.map((c) => (
          <div key={c.id} className="border rounded-xl p-4 space-y-2 relative group">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold flex items-center gap-2">
                  {c.fullName}
                  {c.isPrimary && (
                    <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                      Primary
                    </span>
                  )}
                </p>
                {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setEditing(c)}>
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="w-7 h-7 text-destructive" onClick={() => setDeleting(c)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            {c.email && (
              <p className="text-xs flex items-center gap-1.5 text-muted-foreground">
                <Mail className="w-3 h-3" />{c.email}
              </p>
            )}
            {c.phone && (
              <p className="text-xs flex items-center gap-1.5 text-muted-foreground">
                <Phone className="w-3 h-3" />{c.phone}
              </p>
            )}
            {c.mobile && (
              <p className="text-xs flex items-center gap-1.5 text-muted-foreground">
                <Phone className="w-3 h-3" />{c.mobile}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent onClose={() => setShowAdd(false)}>
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <ContactForm
            isLoading={addMutation.isPending}
            onSubmit={(data) => addMutation.mutate(data)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent onClose={() => setEditing(null)}>
          <DialogHeader><DialogTitle>Edit Contact</DialogTitle></DialogHeader>
          <ContactForm
            defaultValues={editing}
            isLoading={editMutation.isPending}
            onSubmit={(data) => editMutation.mutate(data)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent onClose={() => setDeleting(null)}>
          <DialogHeader><DialogTitle>Delete Contact</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{deleting?.fullName}</strong> from this client's contacts?
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Activity Tab ─── */
function ActivityTab({ client }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');

  const noteMutation = useMutation({
    mutationFn: (content) => api.post(`/clients/${client.id}/notes`, { note: content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', client.id] });
      setNote('');
    },
  });

  const deleteNote = useMutation({
    mutationFn: (noteId) => api.delete(`/clients/${client.id}/notes/${noteId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client', client.id] }),
  });

  const notes = [...(client.clientNotes || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Add note */}
      <div className="border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold">Add Note</h3>
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Add a note about this client..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!note.trim() || noteMutation.isPending}
            onClick={() => noteMutation.mutate(note.trim())}
          >
            {noteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Note
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No activity recorded yet.</p>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="flex gap-3 group">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                {n.user?.fullName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 border rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{n.user?.fullName || n.user?.name || 'System'}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{fmtDate(n.createdAt)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
                      onClick={() => deleteNote.mutate(n.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.note}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Ledger Preview Tab ─── */
function LedgerTab({ client }) {
  const { data: ledger = [], isLoading } = useQuery({
    queryKey: ['client-ledger-preview', client.id],
    queryFn: () => api.get(`/clients/${client.id}/ledger?limit=10`).then((r) => r.data.transactions || []),
  });

  const queryClient = useQueryClient();
  const [showAddTx, setShowAddTx] = useState(false);

  const addTx = useMutation({
    mutationFn: (data) => api.post(`/clients/${client.id}/transactions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-ledger-preview', client.id] });
      queryClient.invalidateQueries({ queryKey: ['client', client.id] });
      setShowAddTx(false);
    },
  });

  const TYPE_LABELS = {
    INVOICE: { label: 'Invoice', class: 'text-orange-600' },
    PAYMENT: { label: 'Payment', class: 'text-green-600' },
    CREDIT_NOTE: { label: 'Credit Note', class: 'text-blue-600' },
    DEBIT_NOTE: { label: 'Debit Note', class: 'text-orange-600' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Recent transactions</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowAddTx(true)}>
            <Plus className="w-4 h-4" /> Add Transaction
          </Button>
          <Link to={`/clients/${client.id}/ledger`}>
            <Button size="sm" variant="outline">
              <BookOpen className="w-4 h-4" /> Full Ledger
            </Button>
          </Link>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Description</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Ref</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Debit</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Credit</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-muted animate-pulse rounded" />
                    </td>
                  ))}
                </tr>
              ))
            ) : ledger.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">No transactions yet</td>
              </tr>
            ) : (
              ledger.map((tx) => {
                const cfg = TYPE_LABELS[tx.type] || {};
                return (
                  <tr key={tx.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(tx.date)}</td>
                    <td className={`px-4 py-3 text-xs font-medium ${cfg.class}`}>{cfg.label}</td>
                    <td className="px-4 py-3 text-xs">{tx.description}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{tx.reference || '—'}</td>
                    <td className="px-4 py-3 text-right text-xs text-orange-600 font-medium">
                      {tx.debit ? fmt(tx.debit) : ''}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-green-600 font-medium">
                      {tx.credit ? fmt(tx.credit) : ''}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold">
                      {fmt(tx.balance)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showAddTx} onOpenChange={setShowAddTx}>
        <DialogContent onClose={() => setShowAddTx(false)}>
          <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
          <TransactionForm
            isLoading={addTx.isPending}
            onSubmit={(data) => addTx.mutate(data)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Main Page ─── */
export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => api.get(`/clients/${id}`).then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/clients/${id}`),
    onSuccess: () => navigate('/clients'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
        <p className="text-muted-foreground">Client not found</p>
        <Link to="/clients"><Button variant="outline" className="mt-3">Back to Clients</Button></Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <Link to="/clients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Clients
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="text-xl font-bold text-primary">{client.companyName.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{client.companyName}</h1>
              <ClientStatusBadge status={client.status} />
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              {client.industry && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{client.industry}</span>
              )}
              {client.city && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{client.city}{client.country ? `, ${client.country}` : ''}
                </span>
              )}
              {client.email && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" />{client.email}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEdit(true)}>
            <Edit2 className="w-4 h-4" /> Edit
          </Button>
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setShowDelete(true)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-1 -mb-px">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview'  && <OverviewTab client={client} />}
      {activeTab === 'contacts'  && <ContactsTab client={client} />}
      {activeTab === 'activity'  && <ActivityTab client={client} />}
      {activeTab === 'ledger'    && <LedgerTab   client={client} />}

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl" onClose={() => setShowEdit(false)}>
          <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>
          <ClientForm
            clientId={id}
            defaultValues={client}
            onSuccess={() => {
              setShowEdit(false);
              queryClient.invalidateQueries({ queryKey: ['client', id] });
              queryClient.invalidateQueries({ queryKey: ['clients'] });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent onClose={() => setShowDelete(false)}>
          <DialogHeader><DialogTitle>Delete Client</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently remove <strong>{client.companyName}</strong>? Clients with transactions will be deactivated instead.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
