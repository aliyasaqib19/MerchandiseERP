import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

export function QuickActions({ actions = [] }) {
  if (actions.length === 0) return null;

  return (
    <div className="bg-card border rounded-xl">
      <div className="px-5 py-4 border-b">
        <h3 className="font-semibold text-sm">Quick Actions</h3>
      </div>
      <div className="p-4 grid grid-cols-2 gap-2">
        {actions.map((action, i) => {
          const Icon = action.icon;
          return (
            <Link
              key={i}
              to={action.to}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                action.primary
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted hover:bg-muted/80 text-foreground'
              )}
            >
              {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
              {action.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
