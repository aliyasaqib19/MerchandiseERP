import { useAuthStore } from '../store/authStore';
import { useWarehouseStore } from '../store/warehouseStore';
import { AdminDashboard } from '../components/dashboard/AdminDashboard';
import { RMDashboard } from '../components/dashboard/RMDashboard';
import { SalesDashboard } from '../components/dashboard/SalesDashboard';
import { TechnicianDashboard } from '../components/dashboard/TechnicianDashboard';

function getDashboardComponent(role) {
  if (!role) return AdminDashboard;
  const r = role.toLowerCase();
  if (r.includes('administrator') || r.includes('admin')) return AdminDashboard;
  if (r.includes('regional') || r.includes('manager') && r.includes('regional')) return RMDashboard;
  if (r.includes('sales')) return SalesDashboard;
  if (r.includes('technician')) return TechnicianDashboard;
  // Default: show whichever the user has permissions for
  return RMDashboard;
}

const ROLE_GREETING = {
  'system administrator': 'Here\'s your system overview.',
  'regional manager': 'Here\'s your business overview.',
  'sales manager': 'Here\'s your sales pipeline.',
  'technician': 'Here\'s your work overview.',
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const activeWarehouse = useWarehouseStore((s) => s.activeWarehouse);
  const roleLower = user?.role?.toLowerCase() || '';
  const greeting = ROLE_GREETING[roleLower] || 'Here\'s what\'s happening today.';
  const Dashboard = getDashboardComponent(user?.role);

  const now = new Date();
  const hour = now.getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.fullName?.split(' ')[0] || 'there';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {timeGreeting}, {firstName} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {greeting}
          {activeWarehouse && (
            <> Viewing <span className="font-medium text-foreground">{activeWarehouse.name}</span>.</>
          )}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="inline-flex items-center gap-1.5 text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {user?.role}
          </span>
          <span className="text-xs text-muted-foreground">
            {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      <Dashboard />
    </div>
  );
}
