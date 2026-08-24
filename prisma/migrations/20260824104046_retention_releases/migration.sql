-- CreateTable
CREATE TABLE "RetentionRelease" (
    "id" BIGSERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "pcId" BIGINT,
    "amountFils" BIGINT NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetentionRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RetentionRelease_projectId_releasedAt_idx" ON "RetentionRelease"("projectId", "releasedAt");

-- CreateIndex
CREATE INDEX "RetentionRelease_pcId_idx" ON "RetentionRelease"("pcId");

-- AddForeignKey
ALTER TABLE "RetentionRelease" ADD CONSTRAINT "RetentionRelease_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionRelease" ADD CONSTRAINT "RetentionRelease_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "PaymentCertificate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
