import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useWarehouseStore } from '../../store/warehouseStore';
import { useWarehouseAccess } from '../../hooks/useWarehouseAccess';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppLayout() {
  const { user, accessToken } = useAuthStore();
  const activeWarehouse = useWarehouseStore((s) => s.activeWarehouse);
  const { readOnly } = useWarehouseAccess();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!accessToken || !user) {
    return <Navigate to="/login" replace />;
  }

  // Must pick a warehouse workspace before entering the app
  if (!activeWarehouse) {
    return <Navigate to="/select-warehouse" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar onMenuToggle={() => setSidebarOpen((v) => !v)} />
        {readOnly && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-sm px-4 py-2 flex items-center gap-2">
            <Eye className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong>View-only mode.</strong> You can view {activeWarehouse.name} but cannot make changes here. Switch to your assigned warehouse to edit.
            </span>
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
