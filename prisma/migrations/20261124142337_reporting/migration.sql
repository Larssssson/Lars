-- CreateEnum
CREATE TYPE "ReportTemplate" AS ENUM ('KOMPAKT', 'MONATSBERICHT', 'MANAGEMENT');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('ENTWURF', 'FREIGEGEBEN');

-- CreateTable
CREATE TABLE "Report" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "template" "ReportTemplate" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "blocks" TEXT[],
    "clientAliases" TEXT[],
    "competitors" TEXT[],
    "tier1" TEXT[],
    "tier2" TEXT[],
    "excludePaid" BOOLEAN NOT NULL DEFAULT true,
    "topicFilter" TEXT[],
    "commentary" TEXT,
    "fileId" UUID,
    "status" "ReportStatus" NOT NULL DEFAULT 'ENTWURF',
    "approvedBy" UUID,
    "approvedAt" TIMESTAMP(3),
    "isSampleData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_clientId_createdAt_idx" ON "Report"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
