-- Restrict users to specific warehouses. Empty array = access to all warehouses.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "warehouseIds" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
