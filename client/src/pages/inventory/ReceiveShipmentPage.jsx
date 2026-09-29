import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PackageCheck, Search, FileText, ArrowLeft } from 'lucide-react';
import { Input } from '../../components/ui/input';
import api from '../../lib/api';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ReceiveShipmentPage() {
  const [search, setSearch] = useState('');

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ['shipments'],
    queryFn: () => api.get('/shipments').then((r) => r.data),
  });

  // Only shipments actually received INTO this warehouse — this page is a
  // history/log, not a workflow step (the multi-step create → approve →
  // receive flow still lives on the Shipments page).
  const received = shipments.filter((s) => s.direction === 'INCOMING' && s.status === 'RECEIVED');

  const q = search.trim().toLowerCase();
  const filtered = q
    ? received.filter((s) =>
        s.shipmentNumber?.toLowerCase().includes(q) ||
        s.consignmentNumber?.toLowerCase().includes(q) ||
        s.sourceWarehouse?.name?.toLowerCase().includes(q) ||
        s.items?.some((i) => i.description?.toLowerCase().includes(q))
      )
    : received;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><PackageCheck className="w-6 h-6" /> Receive Shipment</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Shipments received into this warehouse — quantities, items, and the delivery document for each.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by shipment #, item, or source warehouse..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border rounded-xl py-16 text-center text-muted-foreground">
          <PackageCheck className="w-10 h-10 mx-auto mb-2 opacity-50" />
          {received.length === 0 ? 'No shipments received into this warehouse yet.' : 'No shipments match your search.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <div key={s.id} className="border rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{s.shipmentNumber}</span>
                    {s.consignmentNumber && (
                      <span className="text-xs text-muted-foreground">· CN: {s.consignmentNumber}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <ArrowLeft className="w-3 h-3" /> from {s.sourceWarehouse?.name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Received</p>
                  <p className="text-sm font-medium">{fmtDate(s.receivedAt)}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden mb-3">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="text-left px-3 py-1.5 text-xs font-medium text-muted-foreground">Description</th>
                      <th className="text-right px-3 py-1.5 text-xs font-medium text-muted-foreground">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {s.items?.map((item, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-xs">{item.description}</td>
                        <td className="px-3 py-1.5 text-xs text-right font-medium">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {s.challanUrl ? (
                <a
                  href={s.challanUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={s.challanName || 'document'}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" /> {s.challanName || 'View document'}
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">No document uploaded</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
