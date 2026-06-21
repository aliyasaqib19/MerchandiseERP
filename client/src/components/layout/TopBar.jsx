import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Home, User, Settings, LogOut, Check, CheckCheck, Menu, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useBreadcrumb } from '../../hooks/useBreadcrumb';
import api from '../../lib/api';

export function TopBar({ onMenuToggle }) {
  return (
    <header className="sticky top-0 z-40 h-16 bg-white border-b border-border flex items-center px-4 gap-3">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-md text-muted-foreground hover:bg-muted transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Breadcrumb */}
      <Breadcrumb />

      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}

function Breadcrumb() {
  const crumbs = useBreadcrumb();

  return (
    <nav className="hidden md:flex items-center gap-1 text-sm">
      <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
        <Home className="w-4 h-4" />
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.to} className="flex items-center gap-1">
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          {crumb.isLast ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link to={crumb.to} className="text-muted-foreground hover:text-foreground transition-colors">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();
  const count = unreadCount();

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const typeColors = {
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
    success: 'bg-green-500',
    error: 'bg-red-500',
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md text-muted-foreground hover:bg-muted transition-colors"
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-destructive rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border rounded-xl shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-sm">Notifications</span>
            {count > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3 items-start',
                    !n.read && 'bg-primary/5'
                  )}
                >
                  <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', typeColors[n.type])} />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm', !n.read && 'font-semibold')}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{n.time}</p>
                  </div>
                  {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-2" />}
                </button>
              ))
            )}
          </div>
          <div className="border-t px-4 py-2.5">
            <Link to="/notifications" onClick={() => setOpen(false)} className="text-xs text-primary hover:underline flex items-center gap-1">
              View all notifications <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { user, logout, refreshToken } = useAuthStore();

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function handleLogout() {
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // ignore
    }
    logout();
    navigate('/login', { replace: true });
  }

  const initials = user?.fullName
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
          {initials}
        </div>
        <div className="hidden md:block text-left">
          <p className="text-sm font-medium leading-none">{user?.fullName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{user?.role}</p>
        </div>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-card border rounded-xl shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-semibold">{user?.fullName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <div className="p-1">
            <MenuItem icon={User} label="My Profile" to="/profile" onClick={() => setOpen(false)} />
            <MenuItem icon={Settings} label="Settings" to="/settings" onClick={() => setOpen(false)} />
          </div>
          <div className="p-1 border-t">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, to, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted rounded-md transition-colors"
    >
      <Icon className="w-4 h-4 text-muted-foreground" />
      {label}
    </Link>
  );
}
