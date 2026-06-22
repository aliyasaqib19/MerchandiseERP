import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useWarehouseStore } from '../../store/warehouseStore';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppLayout() {
  const { user, accessToken } = useAuthStore();
  const activeWarehouse = useWarehouseStore((s) => s.activeWarehouse);
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
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
