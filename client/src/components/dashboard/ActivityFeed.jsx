import { cn } from '../../lib/utils';

const TYPE_STYLES = {
  user:     { dot: 'bg-blue-500',   label: 'bg-blue-50 text-blue-700' },
  project:  { dot: 'bg-green-500',  label: 'bg-green-50 text-green-700' },
  sale:     { dot: 'bg-purple-500', label: 'bg-purple-50 text-purple-700' },
  finance:  { dot: 'bg-orange-500', label: 'bg-orange-50 text-orange-700' },
  inventory:{ dot: 'bg-teal-500',   label: 'bg-teal-50 text-teal-700' },
  alert:    { dot: 'bg-red-500',    label: 'bg-red-50 text-red-700' },
};

export function ActivityFeed({ items = [] }) {
  return (
    <div className="bg-card border rounded-xl">
      <div className="px-5 py-4 border-b">
        <h3 className="font-semibold text-sm">Recent Activity</h3>
      </div>
      <div className="divide-y max-h-80 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
        ) : (
          items.map((item, i) => {
            const style = TYPE_STYLES[item.type] || TYPE_STYLES.user;
            return (
              <div key={i} className="flex gap-3 px-5 py-3.5 items-start">
                <div className={cn('w-2 h-2 rounded-full mt-2 flex-shrink-0', style.dot)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{item.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', style.label)}>
                      {item.type.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground">{item.time}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
