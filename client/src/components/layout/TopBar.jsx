import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Home, User, Settings, LogOut, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useBreadcrumb } from '../../hooks/useBreadcrumb';
import NotificationBell from './NotificationBell';
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
