import { useLocation } from 'react-router-dom';

const ROUTE_LABELS = {
  dashboard: 'Dashboard',
  inventory: 'Inventory',
  products: 'Products',
  movements: 'Stock Movements',
  clients: 'Clients',
  contacts: 'Contacts',
  sales: 'Sales',
  quotations: 'Quotations',
  invoices: 'Invoices',
  projects: 'Projects',
  'assigned-projects': 'Assigned Projects',
  'site-visits': 'Site Visits',
  'work-logs': 'Work Logs',
  'service-reports': 'Service Reports',
  finance: 'Finance',
  users: 'Users',
  roles: 'Roles',
  settings: 'Settings',
  profile: 'My Profile',
};

export function useBreadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  const crumbs = segments.map((seg, idx) => ({
    label: ROUTE_LABELS[seg] || seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    to: '/' + segments.slice(0, idx + 1).join('/'),
    isLast: idx === segments.length - 1,
  }));

  return crumbs;
}
