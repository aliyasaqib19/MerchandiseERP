-- Add consignment number and delivery challan to shipments
ALTER TABLE "shipments" ADD COLUMN "consignmentNumber" TEXT;
ALTER TABLE "shipments" ADD COLUMN "challanUrl" TEXT;
ALTER TABLE "shipments" ADD COLUMN "challanName" TEXT;
