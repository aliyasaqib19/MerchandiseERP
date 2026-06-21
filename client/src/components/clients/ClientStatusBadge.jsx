import { cn } from '../../lib/utils';

const CONFIG = {
  ACTIVE:      { label: 'Active',      class: 'bg-green-50 text-green-700 border-green-200' },
  INACTIVE:    { label: 'Inactive',    class: 'bg-gray-50 text-gray-600 border-gray-200' },
  PROSPECT:    { label: 'Prospect',    class: 'bg-blue-50 text-blue-700 border-blue-200' },
  BLACKLISTED: { label: 'Blacklisted', class: 'bg-red-50 text-red-700 border-red-200' },
};

export function ClientStatusBadge({ status }) {
  const cfg = CONFIG[status] || CONFIG.INACTIVE;
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium', cfg.class)}>
      {cfg.label}
    </span>
  );
}
