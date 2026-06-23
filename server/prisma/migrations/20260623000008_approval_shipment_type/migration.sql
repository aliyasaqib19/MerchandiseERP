-- Add SHIPMENT to the approval type enum
ALTER TYPE "ApprovalType" ADD VALUE IF NOT EXISTS 'SHIPMENT';
