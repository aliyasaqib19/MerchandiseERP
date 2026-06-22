-- CreateTable
CREATE TABLE "warehouses" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "capacity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_name_key" ON "warehouses"("name");

-- AlterTable: add warehouseId to products
ALTER TABLE "products" ADD COLUMN "warehouseId" INTEGER;

-- AlterTable: add warehouseId to inventory_transactions
ALTER TABLE "inventory_transactions" ADD COLUMN "warehouseId" INTEGER;

-- AddForeignKey: products → warehouses
ALTER TABLE "products" ADD CONSTRAINT "products_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: inventory_transactions → warehouses
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_warehouseId_fkey"
    FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
