-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "checkStrictness" "Strictness" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "File" ADD COLUMN     "profileSection" TEXT;

-- AlterTable
ALTER TABLE "Finding" ADD COLUMN     "suggestion" "AiInsertionKind";

-- AlterTable
ALTER TABLE "ProfileSuggestion" ADD COLUMN     "model" TEXT,
ADD COLUMN     "promptVersion" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'MENSCH';
