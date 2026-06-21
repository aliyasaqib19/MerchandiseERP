import { cn } from '../../lib/utils';
import { ArrowDownCircle, ArrowUpCircle, RefreshCw, ShoppingCart, RotateCcw } from 'lucide-react';

const TYPE_CONFIG = {
  STOCK_IN:   { label: 'Stock In',    color: 'text-green-700 bg-green-50 border-green-200',   icon: ArrowDownCircle },
  STOCK_OUT:  { label: 'Stock Out',   color: 'text-red-700 bg-red-50 border-red-200',         icon: ArrowUpCircle },
  ADJUSTMENT: { label: 'Adjustment',  color: 'text-blue-700 bg-blue-50 border-blue-200',      icon: RefreshCw },
  SALE:       { label: 'Sale',        color: 'text-purple-700 bg-purple-50 border-purple-200', icon: ShoppingCart },
  RETURN:     { label: 'Return',      color: 'text-orange-700 bg-orange-50 border-orange-200', icon: RotateCcw },
};

export function TransactionTypeBadge({ type }) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.ADJUSTMENT;
  const Icon = config.icon;

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium', config.color)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}
