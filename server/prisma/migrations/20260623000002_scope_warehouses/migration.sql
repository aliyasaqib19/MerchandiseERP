-- Add warehouseId to all warehouse-scoped tables

ALTER TABLE "clients"             ADD COLUMN "warehouseId" INTEGER;
ALTER TABLE "client_transactions" ADD COLUMN "warehouseId" INTEGER;
ALTER TABLE "quotations"          ADD COLUMN "warehouseId" INTEGER;
ALTER TABLE "purchase_orders"     ADD COLUMN "warehouseId" INTEGER;
ALTER TABLE "sales"               ADD COLUMN "warehouseId" INTEGER;
ALTER TABLE "projects"            ADD COLUMN "warehouseId" INTEGER;
ALTER TABLE "documents"           ADD COLUMN "warehouseId" INTEGER;
ALTER TABLE "approval_requests"   ADD COLUMN "warehouseId" INTEGER;

-- Foreign keys (ON DELETE SET NULL so deleting a warehouse keeps records)
ALTER TABLE "clients"             ADD CONSTRAINT "clients_warehouseId_fkey"             FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_transactions" ADD CONSTRAINT "client_transactions_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quotations"          ADD CONSTRAINT "quotations_warehouseId_fkey"          FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_orders"     ADD CONSTRAINT "purchase_orders_warehouseId_fkey"     FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales"               ADD CONSTRAINT "sales_warehouseId_fkey"               FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects"            ADD CONSTRAINT "projects_warehouseId_fkey"            FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "documents"           ADD CONSTRAINT "documents_warehouseId_fkey"           FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approval_requests"   ADD CONSTRAINT "approval_requests_warehouseId_fkey"   FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
