import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell, BellOff, CheckCheck, Trash2, Loader2,
  Info, CheckCircle, AlertTriangle, XCircle, ShieldAlert,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import api from '../../lib/api';

const TYPE_CFG = {
  INFO:               { icon: Info,           cls: 'bg-blue-50   text-blue-600'   },
  SUCCESS:            { icon: CheckCircle,    cls: 'bg-green-50  text-green-600'  },
  WARNING:            { icon: AlertTriangle,  cls: 'bg-amber-50  text-amber-600'  },
  ERROR:              { icon: XCircle,        cls: 'bg-red-50    text-red-600'    },
  APPROVAL_REQUIRED:  { icon: ShieldAlert,    cls: 'bg-purple-50 text-purple-600' },
  APPROVAL_DECIDED:   { icon: CheckCircle,    cls: 'bg-green-50  text-green-700'  },
  LOW_STOCK:          { icon: AlertTriangle,  cls: 'bg-amber-50  text-amber-700'  },
  INVOICE_OVERDUE:    { icon: XCircle,        cls: 'bg-red-50    text-red-700'    },
  PROJECT_UPDATE:     { icon: Info,           cls: 'bg-blue-50   text-blue-700'   },
  PAYMENT_RECEIVED:   { icon: CheckCircle,    cls: 'bg-green-50  text-green-600'  },
  ASSIGNMENT:         { icon: Info,           cls: 'bg-indigo-50 text-indigo-600' },
};

function fmt(d) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications', { params: { limit: 100 } }).then((r) => r.data),
    refetchInterval: 30000,
  });

  async function markAllRead() {
    await api.post('/notifications/mark-read', { ids: 'all' });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  async function markRead(id) {
    await api.post('/notifications/mark-read', { ids: [id] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  async function deleteNotif(id) {
    await api.delete(`/notifications/${id}`);
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  const unread = data?.unreadCount || 0;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Notifications
            {unread > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">{unread}</span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{data?.total || 0} total · {unread} unread</p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={markAllRead}>
            <CheckCheck className="w-4 h-4" /> Mark All Read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : !data?.items?.length ? (
        <div className="text-center py-20 text-muted-foreground">
          <BellOff className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No notifications yet</p>
          <p className="text-sm">You'll see system alerts and updates here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.items.map((n) => {
            const cfg  = TYPE_CFG[n.type] || TYPE_CFG.INFO;
            const Icon = cfg.icon;
            return (
              <div
                key={n.id}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${n.isRead ? 'bg-white' : 'bg-primary/3 border-primary/20'}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.cls}`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium ${n.isRead ? 'text-foreground' : 'text-primary'}`}>{n.title}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{fmt(n.createdAt)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                  {n.link && (
                    <a href={n.link} className="text-xs text-primary hover:underline mt-1 inline-block">View details →</a>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {!n.isRead && (
                    <button onClick={() => markRead(n.id)} title="Mark as read" className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
                      <CheckCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => deleteNotif(n.id)} title="Delete" className="w-7 h-7 rounded-lg hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
