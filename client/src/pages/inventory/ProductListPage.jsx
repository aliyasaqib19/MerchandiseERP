import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Search, Filter, Pencil, Trash2, Eye,
  ArrowDownCircle, ArrowUpCircle, Package,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { StockBadge } from '../../components/inventory/StockBadge';
import ProductForm from '../../components/inventory/ProductForm';
import StockForm from '../../components/inventory/StockForm';
import api from '../../lib/api';
import { cn } from '../../lib/utils';

const STATUS_VARIANT = { ACTIVE: 'success', INACTIVE: 'secondary', DISCONTINUED: 'destructive' };

export default function ProductListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [stockAction, setStockAction] = useState(null); // { product, type: 'in'|'out' }

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['inventory-products', { search, categoryFilter, statusFilter, lowStockOnly }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryFilter) params.set('categoryId', categoryFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (lowStockOnly) params.set('lowStock', 'true');
      return api.get(`/inventory/products?${params}`).then((r) => r.data);
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['inventory-categories'],
    queryFn: () => api.get('/inventory/categories').then((r) => r.data),
  });

  const deleteProduct = useMutation({
    mutationFn: (id) => api.delete(`/inventory/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
    },
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {products.length} product{products.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> Add Product
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-44">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="DISCONTINUED">Discontinued</option>
        </Select>
        <button
          onClick={() => setLowStockOnly((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm border transition-colors',
            lowStockOnly
              ? 'bg-orange-50 border-orange-300 text-orange-700 font-medium'
              : 'border-input text-muted-foreground hover:bg-muted'
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          Low Stock
        </button>
      </div>

      {/* Table */}
      <div className="border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Product</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Stock</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Cost</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Price</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted animate-pulse rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <Package className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">No products found</p>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{product.sku}</span>
                    </td>
                    <td className="px-4 py-3 font-medium">{product.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">{product.category?.name}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <StockBadge
                        quantity={product.quantity}
                        minThreshold={product.minThreshold}
                        unitType={product.unitType}
                        showLabel={true}
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {product.costPrice ? `$${product.costPrice.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {product.sellingPrice ? `$${product.sellingPrice.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[product.status]} className="text-xs">
                        {product.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost" size="icon"
                          title="Stock In"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => setStockAction({ product, type: 'in' })}
                        >
                          <ArrowDownCircle className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          title="Stock Out"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setStockAction({ product, type: 'out' })}
                        >
                          <ArrowUpCircle className="w-4 h-4" />
                        </Button>
                        <Link to={`/inventory/products/${product.id}`}>
                          <Button variant="ghost" size="icon" title="View Details">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost" size="icon" title="Edit"
                          onClick={() => setEditProduct(product)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" title="Delete"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm(`Delete "${product.name}"?`)) deleteProduct.mutate(product.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl" onClose={() => setShowCreate(false)}>
          <DialogHeader><DialogTitle>Add New Product</DialogTitle></DialogHeader>
          <ProductForm onSuccess={() => { setShowCreate(false); invalidateAll(); }} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editProduct} onOpenChange={(v) => !v && setEditProduct(null)}>
        <DialogContent className="max-w-2xl" onClose={() => setEditProduct(null)}>
          <DialogHeader><DialogTitle>Edit Product</DialogTitle></DialogHeader>
          {editProduct && (
            <ProductForm
              defaultValues={editProduct}
              productId={editProduct.id}
              onSuccess={() => { setEditProduct(null); invalidateAll(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Stock In/Out Dialog */}
      <Dialog open={!!stockAction} onOpenChange={(v) => !v && setStockAction(null)}>
        <DialogContent onClose={() => setStockAction(null)}>
          <DialogHeader>
            <DialogTitle>
              {stockAction?.type === 'in' ? 'Stock In' : 'Stock Out'} — {stockAction?.product?.name}
            </DialogTitle>
          </DialogHeader>
          {stockAction && (
            <StockForm
              product={stockAction.product}
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
