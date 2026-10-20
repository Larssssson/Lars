-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "lockRequestedAt" TIMESTAMP(3),
ADD COLUMN     "lockRequestedBy" UUID;

-- AlterTable
ALTER TABLE "DocumentVersion" ADD COLUMN     "status" "TaskStatus";
