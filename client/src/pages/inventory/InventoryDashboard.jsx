import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Package, DollarSign, AlertTriangle, BarChart3, ArrowRight, AlertCircle } from 'lucide-react';
import { StatsCard } from '../../components/dashboard/StatsCard';
import api from '../../lib/api';
import { TransactionTypeBadge } from '../../components/inventory/TransactionTypeBadge';
import { StockBadge } from '../../components/inventory/StockBadge';

function fmt(n) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n);
}

export default function InventoryDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['inventory-stats'],
    queryFn: () => api.get('/inventory/stats').then((r) => r.data),
  });

  const { data: txData } = useQuery({
    queryKey: ['inventory-transactions', { page: 1, limit: 8 }],
    queryFn: () => api.get('/inventory/transactions?limit=8').then((r) => r.data),
  });

  const recentTransactions = txData?.transactions || [];

  const STATS = [
    {
      label: 'Total Products',
      value: isLoading ? '—' : String(stats?.totalProducts ?? 0),
      sub: 'Active SKUs in system',
      icon: Package,
      color: 'blue',
      loading: isLoading,
    },
    {
      label: 'Inventory Value',
      value: isLoading ? '—' : fmt(stats?.totalValue ?? 0),
      sub: 'Total cost value',
      icon: DollarSign,
      color: 'green',
      loading: isLoading,
    },
    {
      label: 'Low Stock Items',
      value: isLoading ? '—' : String(stats?.lowStockCount ?? 0),
      sub: stats?.lowStockCount > 0 ? 'Requires restocking' : 'All items sufficient',
      icon: AlertTriangle,
      color: stats?.lowStockCount > 0 ? 'orange' : 'teal',
      trend: stats?.lowStockCount > 0 ? 'down' : null,
      trendValue: 'Restock needed',
      loading: isLoading,
    },
    {
      label: 'Transactions / Mo.',
      value: isLoading ? '—' : String(stats?.monthlyTransactions ?? 0),
      sub: 'This month',
      icon: BarChart3,
      color: 'purple',
      loading: isLoading,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Monitor stock levels and movements</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/inventory/products"
            className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
          >
            View All Products <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATS.map((s) => <StatsCard key={s.label} {...s} />)}
      </div>

      {/* Low Stock Alert */}
      {stats?.lowStockList?.length > 0 && (
        <div className="border border-orange-200 bg-orange-50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <h3 className="font-semibold text-orange-800">
              Low Stock Alert — {stats.lowStockList.length} item{stats.lowStockList.length > 1 ? 's' : ''} need restocking
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {stats.lowStockList.map((item) => (
              <Link
                key={item.id}
                to={`/inventory/products/${item.id}`}
                className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-orange-100 hover:border-orange-300 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.category?.name} · {item.sku}</p>
                </div>
                <StockBadge quantity={item.quantity} minThreshold={item.minThreshold} unitType={item.unitType} showLabel={false} />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Movements */}
      <div className="border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold">Recent Movements</h3>
          <Link to="/inventory/movements" className="text-xs text-primary hover:underline flex items-center gap-1">
            View All <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Product</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Qty</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Balance</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">By</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentTransactions.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">No transactions yet</td></tr>
              ) : recentTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/inventory/products/${tx.product.id}`} className="hover:text-primary">
                      <p className="font-medium">{tx.product.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{tx.product.sku}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3"><TransactionTypeBadge type={tx.type} /></td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    <span className={tx.type === 'STOCK_IN' || tx.type === 'RETURN' ? 'text-green-600' : 'text-red-600'}>
                      {tx.type === 'STOCK_IN' || tx.type === 'RETURN' ? '+' : '-'}{tx.quantity}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">{tx.product.unitType}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{tx.balanceAfter}</td>
                  <td className="px-4 py-3 text-muted-foreground">{tx.user?.fullName?.split(' ')[0]}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(tx.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
