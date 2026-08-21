-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "challanUploaded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "challanUploadedAt" TIMESTAMP(3),
ADD COLUMN     "invoiceFileName" TEXT,
ADD COLUMN     "invoiceFileUrl" TEXT,
ADD COLUMN     "invoiceUploaded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "invoiceUploadedAt" TIMESTAMP(3);
