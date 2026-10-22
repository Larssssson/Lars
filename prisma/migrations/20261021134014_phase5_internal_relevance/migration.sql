-- AlterTable
ALTER TABLE "ArticleRelevance" ALTER COLUMN "score" DROP NOT NULL,
ALTER COLUMN "reason" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "isInternal" BOOLEAN NOT NULL DEFAULT false;
