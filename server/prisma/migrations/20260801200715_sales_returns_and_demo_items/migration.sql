-- CreateEnum
CREATE TYPE "DemoStatus" AS ENUM ('OUT', 'RETURNED');

-- CreateTable
CREATE TABLE "sales_returns" (
    "id" SERIAL NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "saleId" INTEGER,
    "createdBy" INTEGER NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creditNoteId" INTEGER,
    "warehouseId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_return_items" (
    "id" SERIAL NOT NULL,
    "returnId" INTEGER NOT NULL,
    "productId" INTEGER,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "sales_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_items" (
    "id" SERIAL NOT NULL,
    "demoNumber" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "status" "DemoStatus" NOT NULL DEFAULT 'OUT',
    "dateOut" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturnDate" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" INTEGER NOT NULL,
    "warehouseId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_returns_returnNumber_key" ON "sales_returns"("returnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "sales_returns_creditNoteId_key" ON "sales_returns"("creditNoteId");

-- CreateIndex
CREATE UNIQUE INDEX "demo_items_demoNumber_key" ON "demo_items"("demoNumber");

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_returns" ADD CONSTRAINT "sales_returns_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "client_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_items" ADD CONSTRAINT "sales_return_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_items" ADD CONSTRAINT "demo_items_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_items" ADD CONSTRAINT "demo_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_items" ADD CONSTRAINT "demo_items_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demo_items" ADD CONSTRAINT "demo_items_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
