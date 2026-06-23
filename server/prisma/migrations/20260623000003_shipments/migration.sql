-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('IN_PROCESS', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'RECEIVED', 'DECLINED');

-- CreateTable
CREATE TABLE "shipments" (
    "id" SERIAL NOT NULL,
    "shipmentNumber" TEXT NOT NULL,
    "sourceWarehouseId" INTEGER NOT NULL,
    "destWarehouseId" INTEGER NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'IN_PROCESS',
    "notes" TEXT,
    "createdBy" INTEGER NOT NULL,
    "approvedBy" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "receivedBy" INTEGER,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_items" (
    "id" SERIAL NOT NULL,
    "shipmentId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "shipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipments_shipmentNumber_key" ON "shipments"("shipmentNumber");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_destWarehouseId_fkey" FOREIGN KEY ("destWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_items" ADD CONSTRAINT "shipment_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
