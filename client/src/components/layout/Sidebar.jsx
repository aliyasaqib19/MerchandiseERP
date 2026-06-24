import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  FolderKanban,
  DollarSign,
  Shield,
  Settings,
  ChevronDown,
  Box,
  ArrowLeftRight,
  Building2,
  FileText,
  Receipt,
  Banknote,
  ClipboardList,
  CalendarCheck,
  BookOpen,
  PieChart,
  UserCog,
  X,
  CreditCard,
  Clock,
  BarChart2,
  AlertTriangle,
  CheckSquare,
  FolderOpen,
  Bell,
  Lock,
  TrendingUp,
  UserCircle,
  Warehouse,
  Repeat,
  Truck,
  Tag,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../store/authStore';
import { useWarehouseStore } from '../../store/warehouseStore';

// Full nav tree — each item can have children.
// permission gates visibility; a parent is hidden if zero children are visible.
const NAV_SECTIONS = [
  {
    section: null, // no heading
    items: [
      {
        label: 'Dashboard',
        icon: LayoutDashboard,
        to: '/dashboard',
        permission: null,
      },
    ],
  },
  {
    section: 'Operations',
    items: [
      {
        label: 'Inventory',
        icon: Package,
        permission: 'INVENTORY_VIEW',
        children: [
          { label: 'Overview',        icon: PieChart,        to: '/inventory' },
          { label: 'Products',        icon: Box,             to: '/inventory/products' },
          { label: 'Stock Movements', icon: ArrowLeftRight,  to: '/inventory/movements' },
          { label: 'Shipments',       icon: Truck,           to: '/inventory/shipments' },
          { label: 'Brands',          icon: Tag,             to: '/inventory/brands' },
        ],
      },
      {
        label: 'Clients',
        icon: Building2,
        permission: 'CLIENTS_VIEW',
        children: [
          { label: 'All Clients', icon: Building2,  to: '/clients' },
        ],
      },
      {
        label: 'Sales',
        icon: ShoppingCart,
        permission: 'SALES_VIEW',
        children: [
          { label: 'Overview',        icon: PieChart,      to: '/sales' },
          { label: 'Quotations',      icon: FileText,      to: '/sales/quotations' },
          { label: 'Purchase Orders', icon: ClipboardList, to: '/sales/purchase-orders' },
          { label: 'Sales Orders',    icon: Receipt,       to: '/sales/orders' },
        ],
      },
      {
        label: 'Projects',
        icon: FolderKanban,
        permission: 'PROJECTS_VIEW',
        children: [
          { label: 'All Projects',    icon: FolderKanban,  to: '/projects' },
        ],
      },
      {
        label: 'Finance',
        icon: DollarSign,
        permission: 'FINANCE_VIEW',
        children: [
          { label: 'Overview',         icon: PieChart,       to: '/finance' },
          { label: 'Invoices',         icon: FileText,       to: '/finance/invoices' },
          { label: 'Payments',         icon: CreditCard,     to: '/finance/payments' },
          { label: 'Outstanding',      icon: Clock,          to: '/finance/outstanding' },
          { label: 'Aged Receivables', icon: BarChart2,      to: '/finance/aged-receivables' },
        ],
      },
    ],
  },
  {
    section: 'Workflows',
    items: [
      {
        label: 'Approvals',
        icon: CheckSquare,
        to: '/approvals',
        permission: 'APPROVALS_VIEW',
      },
      {
        label: 'Documents',
        icon: FolderOpen,
        to: '/documents',
        permission: 'DOCUMENTS_VIEW',
      },
      {
        label: 'Notifications',
        icon: Bell,
        to: '/notifications',
        permission: null,
      },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      {
        label: 'Analytics',
        icon: TrendingUp,
        to: '/analytics',
        permission: 'REPORTS_VIEW',
      },
      {
        label: 'Audit Logs',
        icon: Lock,
        to: '/audit',
        permission: 'AUDIT_VIEW',
      },
    ],
  },
  {
    section: 'Administration',
    items: [
      {
        label: 'My Profile',
        icon: UserCircle,
        to: '/profile',
        permission: null,
      },
      {
        label: 'Users',
        icon: UserCog,
        to: '/users',
        permission: 'USERS_VIEW',
      },
      {
        label: 'Roles',
        icon: Shield,
        to: '/roles',
        permission: 'ROLES_VIEW',
      },
      {
        label: 'Settings',
        icon: Settings,
        to: '/settings',
        permission: 'SETTINGS_VIEW',
      },
    ],
  },
];

export function Sidebar({ open, onClose }) {
  const { user } = useAuthStore();
  const hasPermission = useAuthStore((s) => s.hasPermission);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-slate-900 text-slate-100 transition-transform duration-300 lg:static lg:translate-x-0 lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow">
              <Package className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">Merchandise</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active warehouse switcher */}
        <WarehouseSwitcher onLinkClick={onClose} />

        {/* User chip */}
        <div className="px-4 py-3 border-b border-slate-700/60 flex-shrink-0">
          <div className="flex items-center gap-2.5 bg-slate-800/60 rounded-lg px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">
                {user?.fullName?.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
              </span>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate leading-tight">{user?.fullName}</p>
              <p className="text-xs text-slate-400 truncate">{user?.role}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_SECTIONS.map((section, si) => {
            const visibleItems = section.items.filter((item) =>
              item.permission ? hasPermission(item.permission) : true
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={si}>
                {section.section && (
                  <p className="px-3 mb-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                    {section.section}
                  </p>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) =>
                    item.children ? (
                      <NavGroup key={item.label} item={item} onLinkClick={onClose} />
                    ) : (
                      <NavItem key={item.to} item={item} onLinkClick={onClose} />
                    )
                  )}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

function WarehouseSwitcher({ onLinkClick }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeWarehouse = useWarehouseStore((s) => s.activeWarehouse);

  function switchWarehouse() {
    onLinkClick?.();
    queryClient.clear();
    navigate('/select-warehouse');
  }

  return (
    <div className="px-4 py-3 border-b border-slate-700/60 flex-shrink-0">
      <button
        onClick={switchWarehouse}
        className="w-full flex items-center gap-2.5 bg-slate-800/60 hover:bg-slate-800 rounded-lg px-3 py-2 transition-colors group"
        title="Switch warehouse"
      >
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Warehouse className="w-4 h-4 text-primary" />
        </div>
        <div className="overflow-hidden text-left flex-1">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider leading-tight">Warehouse</p>
          <p className="text-sm font-semibold truncate leading-tight">
            {activeWarehouse?.name || 'Select warehouse'}
          </p>
        </div>
        <Repeat className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-100 flex-shrink-0" />
      </button>
    </div>
  );
}

function NavItem({ item, onLinkClick }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      onClick={onLinkClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
          isActive
            ? 'bg-primary text-white shadow-sm'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
        )
      }
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  );
}

function NavGroup({ item, onLinkClick }) {
  const location = useLocation();
  const Icon = item.icon;

  // Auto-expand if any child matches current path
  const isAnyChildActive = item.children.some((c) => location.pathname.startsWith(c.to));
  const [expanded, setExpanded] = useState(isAnyChildActive);

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-all',
          isAnyChildActive
            ? 'text-slate-100 bg-slate-800'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
        )}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')}
        />
      </button>

      {expanded && (
        <div className="mt-0.5 ml-3 pl-3 border-l border-slate-700/60 space-y-0.5">
          {item.children.map((child) => {
            const ChildIcon = child.icon;
            return (
              <NavLink
                key={child.to}
                to={child.to}
                onClick={onLinkClick}
                end
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all',
                    isActive
                      ? 'text-primary font-semibold'
                      : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'
                  )
                }
              >
                <ChildIcon className="w-3.5 h-3.5 flex-shrink-0" />
                {child.label}
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
