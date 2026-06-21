import { cn } from '../../lib/utils';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export function StockBadge({ quantity, minThreshold, unitType, showLabel = true }) {
  const isLow = minThreshold > 0 && quantity <= minThreshold;
  const isWarning = minThreshold > 0 && quantity > minThreshold && quantity <= minThreshold * 1.5;
  const isOk = !isLow && !isWarning;

  const config = isLow
    ? { color: 'text-red-600 bg-red-50 border-red-200', icon: XCircle, label: 'Low Stock' }
    : isWarning
    ? { color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: AlertTriangle, label: 'Warning' }
    : { color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle, label: 'In Stock' };

  const Icon = config.icon;

  return (
    <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium', config.color)}>
      <Icon className="w-3.5 h-3.5" />
      <span className="font-semibold">{quantity}</span>
      {unitType && <span className="opacity-70">{unitType}</span>}
      {showLabel && isLow && <span className="ml-0.5">· {config.label}</span>}
    </div>
  );
}

export function stockStatus(quantity, minThreshold) {
  if (minThreshold > 0 && quantity <= minThreshold) return 'low';
  if (minThreshold > 0 && quantity <= minThreshold * 1.5) return 'warning';
  return 'ok';
}
