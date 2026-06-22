import { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Warehouse, MapPin, Phone, User, Package, ArrowLeftRight,
  BarChart2, ChevronLeft, AlertTriangle, TrendingUp, Activity,
} from 'lucide-react';
import { TransactionTypeBadge } from '../../components/inventory/TransactionTypeBadge';
import api from '../../lib/api';

const TABS = [
  { key: 'overview',   label: 'Overview',        icon: BarChart2 },
  { key: 'products',   label: 'Products',         icon: Package },
  { key: 'movements',  label: 'Stock Movements',  icon: ArrowLeftRight },
];

function StatCard({ icon: Icon, label, value, sub, color = 'primary' }) {
  const colors = {
    primary:  'bg-primary/10 text-primary',
    green:    'bg-green-100 text-green-700',
    orange:   'bg-orange-100 text-orange-700',
    blue:     'bg-blue-100 text-blue-700',
  };
  return (
    <div className="border rounded-2xl p-5 bg-white space-y-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function OverviewTab({ warehouseId }) {
  const { data: stats } = useQuery({
    queryKey: ['warehouse-stats', warehouseId],
    queryFn: () => api.get(`/warehouses/${warehouseId}/stats`).then((r) => r.data),
  });

  const { data: productsData } = useQuery({
    queryKey: ['warehouse-products', warehouseId, 'overview'],
    queryFn: () => api.get(`/warehouses/${warehouseId}/products?limit=5`).then((r) => r.data),
  });

  const { data: movementsData } = useQuery({
    queryKey: ['warehouse-movements', warehouseId, 'overview'],
    queryFn: () => api.get(`/warehouses/${warehouseId}/movements?limit=5`).then((r) => r.data),
  });

  if (!stats) return <div className="py-10 text-center text-muted-foreground">Loading stats...</div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package}      label="Products Stored"  value={stats.productCount}       color="primary" />
        <StatCard icon={TrendingUp}   label="Total Units"      value={stats.totalUnits?.toLocaleString() || 0}  color="blue" />
        <StatCard icon={AlertTriangle} label="Low Stock Items" value={stats.lowStockCount}       color="orange" />
        <StatCard icon={Activity}     label="Total Movements"  value={stats.totalTransactions}   color="green" />
      </div>

      {/* Recent Products + Movements side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Products in Warehouse</h3>
            <Link to="?tab=products" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y">
            {(productsData?.products || []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No products assigned yet</p>
            ) : (
              productsData.products.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${p.quantity <= p.minThreshold ? 'text-orange-600' : 'text-foreground'}`}>
                      {p.quantity} {p.unitType}
                    </p>
                    {p.quantity <= p.minThreshold && (
                      <p className="text-xs text-orange-500">Low stock</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-muted/30 border-b flex items-center justify-between">
            <h3 className="font-semibold text-sm">Recent Movements</h3>
            <Link to="?tab=movements" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y">
            {(movementsData?.transactions || []).length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No movements recorded yet</p>
            ) : (
              movementsData.transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{tx.product?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <TransactionTypeBadge type={tx.type} />
                    <span className={`text-sm font-semibold ${tx.type === 'STOCK_IN' || tx.type === 'RETURN' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'STOCK_IN' || tx.type === 'RETURN' ? '+' : '-'}{tx.quantity}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductsTab({ warehouseId }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-products', warehouseId, search, page],
    queryFn: () =>
      api.get(`/warehouses/${warehouseId}/products?search=${encodeURIComponent(search)}&page=${page}&limit=20`).then((r) => r.data),
  });

  const products = data?.products || [];

  return (
    <div className="space-y-4">
      <input
        className="border rounded-lg px-3 py-2 text-sm w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="Search products..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
      />
      <div className="border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Product</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">SKU</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Category</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Stock</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Cost</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Price</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                  ))}
                </tr>
              ))
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground">
                  No products assigned to this warehouse
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/inventory/products/${p.id}`} className="hover:text-primary hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.category?.name}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={p.quantity <= p.minThreshold ? 'text-orange-600 font-semibold' : ''}>
                      {p.quantity} {p.unitType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {p.costPrice ? `Rs. ${p.costPrice.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {p.sellingPrice ? `Rs. ${p.sellingPrice.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {data?.pages > 1 && (
        <div className="flex justify-end gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-muted"
          >
            Prev
          </button>
          <span className="px-3 py-1.5 text-sm text-muted-foreground">
            {page} / {data.pages}
          </span>
          <button
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-muted"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function MovementsTab({ warehouseId }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['warehouse-movements', warehouseId, page],
    queryFn: () =>
      api.get(`/warehouses/${warehouseId}/movements?page=${page}&limit=20`).then((r) => r.data),
  });

  const transactions = data?.transactions || [];

  return (
    <div className="space-y-4">
      <div className="border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Product</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Qty</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Balance After</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">By</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-muted animate-pulse rounded" /></td>
                  ))}
                </tr>
              ))
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground">
                  No stock movements recorded for this warehouse
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(tx.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{tx.product?.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{tx.product?.sku}</p>
                  </td>
                  <td className="px-4 py-3"><TransactionTypeBadge type={tx.type} /></td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    <span className={tx.type === 'STOCK_IN' || tx.type === 'RETURN' ? 'text-green-600' : 'text-red-600'}>
                      {tx.type === 'STOCK_IN' || tx.type === 'RETURN' ? '+' : '-'}{tx.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{tx.balanceAfter}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{tx.user?.fullName || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate">{tx.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {data?.pages > 1 && (
        <div className="flex justify-end gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-muted">Prev</button>
          <span className="px-3 py-1.5 text-sm text-muted-foreground">{page} / {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-muted">Next</button>
        </div>
      )}
    </div>
  );
}

export default function WarehouseDetailPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'overview';
  const setTab = (t) => setSearchParams(t === 'overview' ? {} : { tab: t });

  const { data: warehouse, isLoading } = useQuery({
    queryKey: ['warehouse', id],
    queryFn: () => api.get(`/warehouses/${id}`).then((r) => r.data),
  });

  if (isLoading) return <div className="p-10 text-center text-muted-foreground">Loading warehouse...</div>;
  if (!warehouse) return <div className="p-10 text-center text-muted-foreground">Warehouse not found.</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb + header */}
      <div>
        <Link to="/warehouses" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ChevronLeft className="w-4 h-4" /> All Warehouses
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Warehouse className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{warehouse.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                {warehouse.city && (
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{warehouse.city}</span>
                )}
                {warehouse.contactPerson && (
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{warehouse.contactPerson}</span>
                )}
                {warehouse.phone && (
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{warehouse.phone}</span>
                )}
              </div>
            </div>
          </div>
          <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
            warehouse.status === 'ACTIVE'
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            {warehouse.status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'overview'  && <OverviewTab  warehouseId={Number(id)} />}
        {tab === 'products'  && <ProductsTab  warehouseId={Number(id)} />}
        {tab === 'movements' && <MovementsTab warehouseId={Number(id)} />}
      </div>
    </div>
  );
}
