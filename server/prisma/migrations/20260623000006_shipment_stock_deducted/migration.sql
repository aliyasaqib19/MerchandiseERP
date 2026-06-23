-- Track whether source stock has already been deducted for a shipment
ALTER TABLE "shipments" ADD COLUMN "stockDeducted" BOOLEAN NOT NULL DEFAULT false;
