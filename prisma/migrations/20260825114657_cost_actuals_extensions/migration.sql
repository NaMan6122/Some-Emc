-- CreateEnum
CREATE TYPE "CostEntryKind" AS ENUM ('INVOICE', 'PAYMENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CostCategory" ADD VALUE 'MATERIAL';
ALTER TYPE "CostCategory" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "CostEntry" ADD COLUMN     "kind" "CostEntryKind" NOT NULL DEFAULT 'INVOICE',
ADD COLUMN     "lpoId" BIGINT,
ADD COLUMN     "supplierId" INTEGER;

-- CreateIndex
CREATE INDEX "CostEntry_supplierId_idx" ON "CostEntry"("supplierId");

-- CreateIndex
CREATE INDEX "CostEntry_lpoId_idx" ON "CostEntry"("lpoId");

-- AddForeignKey
ALTER TABLE "CostEntry" ADD CONSTRAINT "CostEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEntry" ADD CONSTRAINT "CostEntry_lpoId_fkey" FOREIGN KEY ("lpoId") REFERENCES "Lpo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
