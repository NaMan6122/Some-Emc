-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('LABOUR_INHOUSE', 'LABOUR_SUBCONTRACT', 'SUPERVISION', 'ADMIN', 'DLP');

-- CreateTable
CREATE TABLE "CostLine" (
    "id" BIGSERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "category" "CostCategory" NOT NULL,
    "amountFils" BIGINT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostEntry" (
    "id" BIGSERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "category" "CostCategory" NOT NULL,
    "entryDate" DATE NOT NULL,
    "amountFils" BIGINT NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostLine_projectId_category_idx" ON "CostLine"("projectId", "category");

-- CreateIndex
CREATE INDEX "CostEntry_projectId_category_entryDate_idx" ON "CostEntry"("projectId", "category", "entryDate");

-- AddForeignKey
ALTER TABLE "CostLine" ADD CONSTRAINT "CostLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostEntry" ADD CONSTRAINT "CostEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
