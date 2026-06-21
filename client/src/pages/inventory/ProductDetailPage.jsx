import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Pencil, ArrowDownCircle, ArrowUpCircle,
  Package, DollarSign, BarChart3, AlertTriangle,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { StockBadge } from '../../components/inventory/StockBadge';
import { TransactionTypeBadge } from '../../components/inventory/TransactionTypeBadge';
import ProductForm from '../../components/inventory/ProductForm';
import StockForm from '../../components/inventory/StockForm';
import api from '../../lib/api';

const STATUS_VARIANT = { ACTIVE: 'success', INACTIVE: 'secondary', DISCONTINUED: 'destructive' };

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [stockAction, setStockAction] = useState(null);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['inventory-product', id],
    queryFn: () => api.get(`/inventory/products/${id}`).then((r) => r.data),
  });

  if (isLoading) return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
    </div>
  );

  if (error || !product) return (
    <div className="p-6 text-center">
      <p className="text-muted-foreground">Product not found.</p>
      <Button variant="outline" className="mt-4" onClick={() => navigate('/inventory/products')}>
        Back to Products
      </Button>
    </div>
  );

  const inventoryValue = product.costPrice ? product.quantity * product.costPrice : null;
  const margin = product.costPrice && product.sellingPrice
    ? (((product.sellingPrice - product.costPrice) / product.costPrice) * 100).toFixed(1)
    : null;

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['inventory-product', id] });
    queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold">{product.name}</h1>
              <Badge variant={STATUS_VARIANT[product.status]} className="text-xs">{product.status}</Badge>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded border">{product.sku}</span>
              <span className="text-xs text-muted-foreground">{product.category?.name}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => setStockAction({ type: 'out' })} className="text-red-600 border-red-200 hover:bg-red-50">
            <ArrowUpCircle className="w-4 h-4" /> Stock Out
          </Button>
          <Button size="sm" onClick={() => setStockAction({ type: 'in' })} className="bg-green-600 hover:bg-green-700">
            <ArrowDownCircle className="w-4 h-4" /> Stock In
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            <Pencil className="w-4 h-4" /> Edit
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InfoCard
          icon={Package}
          iconColor="bg-blue-500"
          label="Current Stock"
          value={<StockBadge quantity={product.quantity} minThreshold={product.minThreshold} unitType={product.unitType} />}
        />
        <InfoCard
          icon={AlertTriangle}
          iconColor="bg-orange-500"
          label="Min. Threshold"
          value={`${product.minThreshold} ${product.unitType}`}
        />
        {inventoryValue !== null && (
          <InfoCard
            icon={DollarSign}
            iconColor="bg-green-500"
            label="Stock Value"
            value={`$${inventoryValue.toFixed(2)}`}
          />
        )}
        {margin !== null && (
          <InfoCard
            icon={BarChart3}
            iconColor="bg-purple-500"
            label="Margin"
            value={`${margin}%`}
          />
        )}
      </div>

      {/* Product Details */}
      <div className="border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b bg-muted/30">
          <h3 className="font-semibold">Product Details</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-5">
          <Detail label="SKU">{product.sku}</Detail>
          <Detail label="Category">{product.category?.name}</Detail>
          <Detail label="Unit Type">{product.unitType}</Detail>
          <Detail label="Cost Price">{product.costPrice ? `Rs. ${product.costPrice.toFixed(2)}` : '—'}</Detail>
          <Detail label="Selling Price">{product.sellingPrice ? `Rs. ${product.sellingPrice.toFixed(2)}` : '—'}</Detail>
          <Detail label="Created">{new Date(product.createdAt).toLocaleDateString()}</Detail>
          {product.description && (
            <Detail label="Description" className="col-span-full">{product.description}</Detail>
          )}
        </div>
      </div>

      {/* Transaction History */}
      <div className="border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold">Transaction History</h3>
          <Link to={`/inventory/movements?productId=${product.id}`} className="text-xs text-primary hover:underline">
            View full history
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Quantity</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Balance</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Reference</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">By</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {product.transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-muted-foreground">No transactions yet</td>
                </tr>
              ) : product.transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(tx.createdAt).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                  <td className="px-4 py-2.5"><TransactionTypeBadge type={tx.type} /></td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium">
                    <span className={tx.type === 'STOCK_IN' || tx.type === 'RETURN' ? 'text-green-600' : 'text-red-600'}>
                      {tx.type === 'STOCK_IN' || tx.type === 'RETURN' ? '+' : '-'}{tx.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{tx.balanceAfter}</td>
                  <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{tx.reference || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{tx.user?.fullName?.split(' ')[0]}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[160px] truncate">{tx.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-2xl" onClose={() => setShowEdit(false)}>
          <DialogHeader><DialogTitle>Edit Product</DialogTitle></DialogHeader>
          <ProductForm
            defaultValues={product}
            productId={product.id}
            onSuccess={() => { setShowEdit(false); invalidateAll(); }}
          />
        </DialogContent>
      </Dialog>

      {/* Stock Dialog */}
      <Dialog open={!!stockAction} onOpenChange={(v) => !v && setStockAction(null)}>
        <DialogContent onClose={() => setStockAction(null)}>
          <DialogHeader>
            <DialogTitle>{stockAction?.type === 'in' ? 'Stock In' : 'Stock Out'}</DialogTitle>
          </DialogHeader>
          {stockAction && (
            <StockForm
              product={product}
              type={stockAction.type}
              onSuccess={() => { setStockAction(null); invalidateAll(); }}
              onCancel={() => setStockAction(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoCard({ icon: Icon, iconColor, label, value }) {
  return (
    <div className="border rounded-xl p-4">
      <div className={`w-8 h-8 rounded-lg ${iconColor} flex items-center justify-center mb-2`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 font-semibold text-sm">{value}</div>
    </div>
  );
}

function Detail({ label, children, className }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium">{children}</p>
    </div>
  );
}
