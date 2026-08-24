-- CreateTable
CREATE TABLE "LpoAllocation" (
    "id" BIGSERIAL NOT NULL,
    "lpoId" BIGINT NOT NULL,
    "targetProjectId" INTEGER NOT NULL,
    "pct" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LpoAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LpoAllocation_targetProjectId_idx" ON "LpoAllocation"("targetProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "LpoAllocation_lpoId_targetProjectId_key" ON "LpoAllocation"("lpoId", "targetProjectId");

-- AddForeignKey
ALTER TABLE "LpoAllocation" ADD CONSTRAINT "LpoAllocation_lpoId_fkey" FOREIGN KEY ("lpoId") REFERENCES "Lpo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LpoAllocation" ADD CONSTRAINT "LpoAllocation_targetProjectId_fkey" FOREIGN KEY ("targetProjectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
