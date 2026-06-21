import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import api from '../../lib/api';

const TYPE_COLORS = {
  APPROVAL_REQUIRED: 'bg-purple-500',
  LOW_STOCK:         'bg-amber-500',
  INVOICE_OVERDUE:   'bg-red-500',
  ERROR:             'bg-red-500',
  WARNING:           'bg-amber-500',
  SUCCESS:           'bg-green-500',
  PAYMENT_RECEIVED:  'bg-green-500',
};

function fmt(d) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications-bell'],
    queryFn: () => api.get('/notifications', { params: { limit: 8 } }).then((r) => r.data),
    refetchInterval: 30000,
  });

  const unread = data?.unreadCount || 0;

  async function markAllRead(e) {
    e.stopPropagation();
    await api.post('/notifications/mark-read', { ids: 'all' });
    qc.invalidateQueries({ queryKey: ['notifications-bell'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
      >
        <Bell className="w-4.5 h-4.5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-80 bg-white border rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <span className="font-semibold text-sm">Notifications</span>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <CheckCheck className="w-3 h-3" /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto divide-y">
              {!data?.items?.length ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications</div>
              ) : (
                data.items.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer ${n.isRead ? '' : 'bg-primary/3'}`}
                    onClick={() => { setOpen(false); if (n.link) navigate(n.link); }}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${TYPE_COLORS[n.type] || 'bg-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{fmt(n.createdAt)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="border-t px-4 py-2.5">
              <button
                onClick={() => { setOpen(false); navigate('/notifications'); }}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                View all notifications <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
