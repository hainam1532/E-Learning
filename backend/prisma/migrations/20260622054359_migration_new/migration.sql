-- DropForeignKey
ALTER TABLE "videos" DROP CONSTRAINT "videos_lessonId_fkey";

-- AlterTable
ALTER TABLE "videos" ALTER COLUMN "lessonId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
