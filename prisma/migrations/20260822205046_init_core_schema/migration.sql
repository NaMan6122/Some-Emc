-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGEMENT', 'PROCUREMENT', 'COMMERCIAL', 'FINANCE', 'VIEWER');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'CLOSED');

-- CreateEnum
CREATE TYPE "Trade" AS ENUM ('ELECTRICAL', 'PLUMBING', 'HVAC', 'FIRE_FIGHTING', 'GENERAL', 'HSE', 'OTHER');

-- CreateEnum
CREATE TYPE "LpoStatus" AS ENUM ('DRAFT', 'ISSUED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LpoKind" AS ENUM ('STANDARD', 'VARIATION', 'INTERNAL_TRANSFER');

-- CreateEnum
CREATE TYPE "Verification" AS ENUM ('PENDING', 'VERIFIED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "PcStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CERTIFIED', 'PAID');

-- CreateEnum
CREATE TYPE "Provenance" AS ENUM ('SOURCE_DOCUMENT', 'OCR_ESTIMATE', 'CLIENT_SUMMARY', 'DERIVED', 'IMPORTED_REPORT');

-- CreateEnum
CREATE TYPE "VoStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mainContractor" TEXT NOT NULL,
    "contractValueFils" BIGINT NOT NULL,
    "vatRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" JSONB NOT NULL DEFAULT '[]',
    "mergedIntoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lpo" (
    "id" BIGSERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "refNo" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "revisionOfId" BIGINT,
    "revisionNo" INTEGER NOT NULL DEFAULT 0,
    "supersededById" BIGINT,
    "supplierId" INTEGER NOT NULL,
    "trade" "Trade" NOT NULL,
    "description" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "amountFils" BIGINT NOT NULL,
    "vatRate" DECIMAL(5,4) NOT NULL,
    "kind" "LpoKind" NOT NULL DEFAULT 'STANDARD',
    "status" "LpoStatus" NOT NULL DEFAULT 'DRAFT',
    "verification" "Verification" NOT NULL DEFAULT 'PENDING',
    "provenance" "Provenance" NOT NULL DEFAULT 'SOURCE_DOCUMENT',
    "remark" TEXT,
    "voId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lpo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" BIGSERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "trade" "Trade" NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'MATERIALS',
    "amountFils" BIGINT NOT NULL,
    "sourceLabel" TEXT NOT NULL,
    "refDate" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentCertificate" (
    "id" BIGSERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "pcNumber" INTEGER NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "invoiceDate" TIMESTAMP(3),
    "grossFils" BIGINT NOT NULL,
    "retentionFils" BIGINT NOT NULL,
    "netPayableFils" BIGINT NOT NULL,
    "variationClaimFils" BIGINT NOT NULL DEFAULT 0,
    "statedCumulativeFils" BIGINT,
    "status" "PcStatus" NOT NULL DEFAULT 'DRAFT',
    "provenance" "Provenance" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariationOrder" (
    "id" BIGSERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "voNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "status" "VoStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedValueFils" BIGINT NOT NULL,
    "approvedValueFils" BIGINT,
    "approvedAt" TIMESTAMP(3),
    "approvalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariationOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "actorId" INTEGER NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataFlag" (
    "id" BIGSERIAL NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assigneeId" INTEGER,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Lpo_supersededById_key" ON "Lpo"("supersededById");

-- CreateIndex
CREATE INDEX "Lpo_projectId_issueDate_idx" ON "Lpo"("projectId", "issueDate");

-- CreateIndex
CREATE INDEX "Lpo_supplierId_idx" ON "Lpo"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "Lpo_projectId_refNo_key" ON "Lpo"("projectId", "refNo");

-- CreateIndex
CREATE UNIQUE INDEX "Lpo_projectId_seq_key" ON "Lpo"("projectId", "seq");

-- CreateIndex
CREATE INDEX "BudgetLine_projectId_trade_idx" ON "BudgetLine"("projectId", "trade");

-- CreateIndex
CREATE INDEX "PaymentCertificate_projectId_idx" ON "PaymentCertificate"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCertificate_projectId_pcNumber_key" ON "PaymentCertificate"("projectId", "pcNumber");

-- CreateIndex
CREATE UNIQUE INDEX "VariationOrder_projectId_voNumber_key" ON "VariationOrder"("projectId", "voNumber");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "DataFlag_entityType_entityId_idx" ON "DataFlag"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "DataFlag_status_idx" ON "DataFlag"("status");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lpo" ADD CONSTRAINT "Lpo_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lpo" ADD CONSTRAINT "Lpo_revisionOfId_fkey" FOREIGN KEY ("revisionOfId") REFERENCES "Lpo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lpo" ADD CONSTRAINT "Lpo_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "Lpo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lpo" ADD CONSTRAINT "Lpo_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lpo" ADD CONSTRAINT "Lpo_voId_fkey" FOREIGN KEY ("voId") REFERENCES "VariationOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCertificate" ADD CONSTRAINT "PaymentCertificate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariationOrder" ADD CONSTRAINT "VariationOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
