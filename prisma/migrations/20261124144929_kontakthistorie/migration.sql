-- CreateEnum
CREATE TYPE "ContactEventKind" AS ENUM ('VERSAND', 'TELEFONAT', 'MAIL', 'TREFFEN', 'HINTERGRUND', 'SONSTIGES');

-- CreateTable
CREATE TABLE "ContactEvent" (
    "id" UUID NOT NULL,
    "journalistId" UUID NOT NULL,
    "userId" UUID,
    "clientId" UUID,
    "taskId" UUID,
    "kind" "ContactEventKind" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "isSampleData" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID,

    CONSTRAINT "ContactEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactEvent_journalistId_at_idx" ON "ContactEvent"("journalistId", "at");

-- AddForeignKey
ALTER TABLE "ContactEvent" ADD CONSTRAINT "ContactEvent_journalistId_fkey" FOREIGN KEY ("journalistId") REFERENCES "Journalist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactEvent" ADD CONSTRAINT "ContactEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactEvent" ADD CONSTRAINT "ContactEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactEvent" ADD CONSTRAINT "ContactEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
