import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Users, Phone, Mail, Star } from 'lucide-react';
import { Input } from '../../components/ui/input';
import api from '../../lib/api';

export default function ContactsPage() {
  const [search, setSearch] = useState('');

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['all-contacts', search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      return api.get(`/clients/all-contacts?${params}`).then((r) => r.data);
    },
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''} across all clients
          </p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading contacts...</div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-16 border rounded-xl">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No contacts found</p>
          <p className="text-sm text-muted-foreground mt-1">Add contacts from the client detail pages</p>
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
                      <Link to={`/clients/${c.client.id}`} className="text-primary hover:underline font-medium">
                        {c.client.companyName}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                        <Phone className="w-3 h-3" /> {c.phone}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                        <Mail className="w-3 h-3" /> {c.email}
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
