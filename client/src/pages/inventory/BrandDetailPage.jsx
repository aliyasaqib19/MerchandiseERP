import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Tag, Package, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import api from '../../lib/api';

function money(n) {
  return `Rs. ${Number(n || 0).toLocaleString()}`;
}

export default function BrandDetailPage() {
  const { id } = useParams();

  const { data: brand } = useQuery({
    queryKey: ['brand', id],
    queryFn: () => api.get(`/brands/${id}`).then((r) => r.data),
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['brand-products', id],
    queryFn: () => api.get(`/brands/${id}/products`).then((r) => r.data),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <Link to="/inventory/brands" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Brands
      </Link>

      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
          <Tag className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{brand?.name || '...'}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{products.length} product{products.length !== 1 ? 's' : ''} across all warehouses</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 border rounded-xl">
          <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No products for this brand yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add products and assign them to this brand.</p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Product</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Model No.</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Warehouse</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">In Stock</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Price</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{p.warehouse?.name || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono">{p.quantity}<span className="text-xs text-muted-foreground ml-1">{p.unitType}</span></td>
                  <td className="px-4 py-3 text-right">{p.sellingPrice != null ? money(p.sellingPrice) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/inventory/brands/${id}/products/${p.id}`}>
                      <Button size="sm" variant="outline">
                        Client Distribution <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
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
