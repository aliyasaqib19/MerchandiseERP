-- Add DELIVERY (in-transit, after shipment details added) to shipment status
ALTER TYPE "ShipmentStatus" ADD VALUE IF NOT EXISTS 'DELIVERY' AFTER 'REJECTED';
