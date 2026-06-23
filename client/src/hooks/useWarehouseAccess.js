import { useAuthStore } from '../store/authStore';
import { useWarehouseStore } from '../store/warehouseStore';

// Determines whether the current user may MODIFY data in the active warehouse.
//
// Rules:
//  - System Administrator: full access everywhere.
//  - User with no warehouse assignment (empty list): full access everywhere.
//  - User assigned to warehouses: full access in those warehouses, VIEW-ONLY
//    in any other warehouse.
export function useWarehouseAccess() {
  const user = useAuthStore((s) => s.user);
  const activeWarehouse = useWarehouseStore((s) => s.activeWarehouse);

  const roles = user?.roles || (user?.role ? [user.role] : []);
  const isAdmin = roles.includes('System Administrator');
  const allowed = user?.warehouseIds || [];

  const canEdit =
    isAdmin ||
    allowed.length === 0 ||
    (!!activeWarehouse && allowed.includes(activeWarehouse.id));

  return { canEdit, readOnly: !canEdit, activeWarehouse };
}
