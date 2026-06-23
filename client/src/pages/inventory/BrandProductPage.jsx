import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Package, Users, Boxes, Loader2, Building2 } from 'lucide-react';
import api from '../../lib/api';

function money(n) {
  return `Rs. ${Number(n || 0).toLocaleString()}`;
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

const STATUS_CLASS = {
  DELIVERED: 'bg-green-50 text-green-700',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  DRAFT:     'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-50 text-red-700',
};

export default function BrandProductPage() {
  const { id, productId } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['product-distribution', productId],
    queryFn: () => api.get(`/brands/products/${productId}/distribution`).then((r) => r.data),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  const product = data?.product;
  const totals = data?.totals || {};
  const byClient = data?.byClient || [];
  const lines = data?.lines || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <Link to={`/inventory/brands/${id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to {product?.brand?.name || 'Brand'}
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
          <Package className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{product?.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="font-mono">{product?.sku}</span>
            {product?.brand?.name && <span className="bg-muted px-2 py-0.5 rounded-full">{product.brand.name}</span>}
            {product?.category && <span>{product.category}</span>}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Boxes className="w-4 h-4" /> In Stock</div>
          <p className="text-2xl font-bold mt-1">{product?.quantity ?? 0}<span className="text-sm text-muted-foreground ml-1">{product?.unitType}</span></p>
        </div>
        <div className="border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Package className="w-4 h-4" /> Total Given to Clients</div>
          <p className="text-2xl font-bold mt-1 text-orange-600">{totals.totalGiven || 0}</p>
        </div>
        <div className="border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Users className="w-4 h-4" /> Clients</div>
          <p className="text-2xl font-bold mt-1">{totals.clients || 0}</p>
        </div>
        <div className="border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground text-xs"><Building2 className="w-4 h-4" /> Total Value</div>
          <p className="text-2xl font-bold mt-1 text-green-600">{money(totals.totalValue)}</p>
        </div>
      </div>

      {/* Per-client breakdown */}
      <div>
        <h3 className="font-semibold text-sm mb-3">Given to Clients</h3>
        {byClient.length === 0 ? (
          <div className="text-center py-12 border rounded-xl text-muted-foreground text-sm">
            This product has not been given to any client yet.
          </div>
        ) : (
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Client</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Quantity Taken</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Orders</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {byClient.map((c) => (
                  <tr key={c.clientId || c.companyName} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">
                      {c.clientId ? <Link to={`/clients/${c.clientId}`} className="text-primary hover:underline">{c.companyName}</Link> : c.companyName}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">{c.quantity}</td>
                    <td className="px-4 py-3 text-right">{c.orders}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">{money(c.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full order line history */}
      {lines.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-3">Order History</h3>
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Order</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Client</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Unit Price</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((l) => (
                  <tr key={l.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(l.saleDate)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{l.saleNumber}</td>
                    <td className="px-4 py-3">{l.companyName}</td>
                    <td className="px-4 py-3 text-right font-mono">{l.quantity}</td>
                    <td className="px-4 py-3 text-right">{money(l.unitPrice)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{money(l.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_CLASS[l.saleStatus] || 'bg-gray-100 text-gray-600'}`}>{l.saleStatus}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
