-- AlterEnum
ALTER TYPE "ArticleActionKind" ADD VALUE 'PRESSESPIEGEL';

-- AlterTable
ALTER TABLE "ShiftType" ADD COLUMN     "taskDueTime" TEXT;
