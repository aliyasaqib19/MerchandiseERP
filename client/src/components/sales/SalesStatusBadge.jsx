import { cn } from '../../lib/utils';

const CONFIGS = {
  // Quotation
  DRAFT:    { label: 'Draft',    class: 'bg-gray-50 text-gray-600 border-gray-200' },
  SENT:     { label: 'Sent',     class: 'bg-blue-50 text-blue-700 border-blue-200' },
  APPROVED: { label: 'Approved', class: 'bg-green-50 text-green-700 border-green-200' },
  REJECTED: { label: 'Rejected', class: 'bg-red-50 text-red-700 border-red-200' },
  EXPIRED:  { label: 'Expired',  class: 'bg-orange-50 text-orange-700 border-orange-200' },
  // PO
  PENDING:   { label: 'Pending',   class: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  CANCELLED: { label: 'Cancelled', class: 'bg-gray-50 text-gray-500 border-gray-200' },
  // Sale
  CONFIRMED: { label: 'Confirmed', class: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  DELIVERED: { label: 'Delivered', class: 'bg-green-50 text-green-700 border-green-200' },
};

export function SalesStatusBadge({ status }) {
  const cfg = CONFIGS[status] || CONFIGS.DRAFT;
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium', cfg.class)}>
      {cfg.label}
    </span>
  );
}
