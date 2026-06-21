const STATUS_MAP = {
  PLANNING:  { label: 'Planning',  cls: 'bg-blue-50   text-blue-700   border-blue-200'   },
  ACTIVE:    { label: 'Active',    cls: 'bg-green-50  text-green-700  border-green-200'  },
  ON_HOLD:   { label: 'On Hold',   cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  COMPLETED: { label: 'Completed', cls: 'bg-teal-50   text-teal-700   border-teal-200'   },
  CLOSED:    { label: 'Closed',    cls: 'bg-gray-50   text-gray-600   border-gray-200'   },
  CANCELLED: { label: 'Cancelled', cls: 'bg-red-50    text-red-700    border-red-200'    },
};

export default function ProjectStatusBadge({ status }) {
  const { label, cls } = STATUS_MAP[status] || { label: status, cls: 'bg-gray-50 text-gray-700 border-gray-200' };
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}
