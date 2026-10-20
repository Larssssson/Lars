-- AlterTable
ALTER TABLE "File" ADD COLUMN     "taskId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Shift_shiftTypeId_date_userId_key" ON "Shift"("shiftTypeId", "date", "userId");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
