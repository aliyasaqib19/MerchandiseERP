import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Holds the currently active warehouse workspace. The whole app is scoped to it
// via the x-warehouse-id header (see lib/api.js).
export const useWarehouseStore = create(
  persist(
    (set) => ({
      activeWarehouse: null, // { id, name, city, ... }

      setActiveWarehouse: (warehouse) => set({ activeWarehouse: warehouse }),

      clearActiveWarehouse: () => set({ activeWarehouse: null }),
    }),
    {
      name: 'merchandise-warehouse',
      partialize: (state) => ({ activeWarehouse: state.activeWarehouse }),
    }
  )
);
