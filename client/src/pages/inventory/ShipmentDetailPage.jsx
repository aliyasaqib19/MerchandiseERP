import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2, Package, ArrowRight, ArrowLeft, Truck, FileText,
} from 'lucide-react';
import api from '../../lib/api';

const STATUS_CFG = {
  PENDING_APPROVAL: { label: 'Waiting for Approval', cls: 'bg-amber-50 text-amber-700' },
  APPROVED:         { label: 'Approved',             cls: 'bg-blue-50 text-blue-700' },
  REJECTED:         { label: 'Rejected',             cls: 'bg-red-50 text-red-700' },
  DELIVERY:         { label: 'Delivery',             cls: 'bg-indigo-50 text-indigo-700' },
  RECEIVED:         { label: 'Received',             cls: 'bg-green-50 text-green-700' },
  DECLINED:         { label: 'Declined',             cls: 'bg-red-50 text-red-700' },
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value ?? '—'}</span>
    </div>
  );
}

export default function ShipmentDetailPage() {
  const { id } = useParams();

  const { data: s, isLoading, isError } = useQuery({
    queryKey: ['shipment-detail', id],
    queryFn: () => api.get(`/shipments/${id}`).then((r) => r.data),
  });

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }
  if (isError || !s) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Link to="/inventory/shipments" className="text-sm text-primary hover:underline inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back to Shipments</Link>
        <p className="mt-6 text-muted-foreground">Shipment not found.</p>
      </div>
    );
  }

  const sc = STATUS_CFG[s.status] || { label: s.status, cls: 'bg-gray-50 text-gray-600' };
  const totalQty = (s.items || []).reduce((sum, it) => sum + (it.quantity || 0), 0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link to="/inventory/shipments" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to Shipments
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" /> {s.shipmentNumber}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 inline-flex items-center gap-1.5">
            {s.sourceWarehouse?.name} <ArrowRight className="w-3.5 h-3.5" /> {s.destWarehouse?.name}
          </p>
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sc.cls}`}>{sc.label}</span>
      </div>

      {/* Summary */}
      <div className="bg-white border rounded-xl p-5 grid sm:grid-cols-2 gap-x-10">
        <Row label="SR / Shipment #" value={s.shipmentNumber} />
        <Row label="Consignment #" value={s.consignmentNumber} />
        <Row label="Source Warehouse" value={s.sourceWarehouse?.name} />
        <Row label="Destination Warehouse" value={s.destWarehouse?.name} />
        <Row label="Created By" value={s.createdByUser?.fullName} />
        <Row label="Created" value={fmt(s.createdAt)} />
        <Row label="Total Items" value={s.items?.length} />
        <Row label="Total Quantity" value={totalQty} />
        {s.challanUrl && (
          <Row label="Delivery Challan" value={<a href={s.challanUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {s.challanName || 'View'}</a>} />
        )}
      </div>

      {/* Items */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b text-sm font-semibold">
          <Package className="w-4 h-4 text-primary" /> Shipment Items
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Manufacture No.</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Product</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Brand</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Quantity</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {s.items?.map((it) => (
              <tr key={it.id} className="hover:bg-muted/10">
                <td className="px-4 py-2.5 font-mono text-xs">{it.sku || it.product?.sku || '—'}</td>
                <td className="px-4 py-2.5">
                  {it.product?.id ? (
                    <Link to={`/inventory/products/${it.product.id}`} className="text-primary hover:underline">{it.product?.name || it.description}</Link>
                  ) : (
                    it.product?.name || it.description
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{it.product?.brand?.name || '—'}</td>
                <td className="px-4 py-2.5 text-right font-medium">{it.quantity} {it.product?.unitType || ''}</td>
              </tr>
            ))}
            {!s.items?.length && (
              <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No items on this shipment</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
