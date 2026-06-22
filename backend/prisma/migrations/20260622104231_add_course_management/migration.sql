/*
  Warnings:

  - You are about to drop the column `description` on the `courses` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `courses` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `courses` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "courses" DROP COLUMN "description",
DROP COLUMN "title",
ADD COLUMN     "academyId" INTEGER,
ADD COLUMN     "benefits" JSONB,
ADD COLUMN     "categoryId" INTEGER,
ADD COLUMN     "coverImage" TEXT,
ADD COLUMN     "description_en" TEXT,
ADD COLUMN     "description_vi" TEXT,
ADD COLUMN     "description_zh" TEXT,
ADD COLUMN     "instructorId" INTEGER,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "tags" JSONB,
ADD COLUMN     "targetAudience" TEXT,
ADD COLUMN     "title_en" TEXT,
ADD COLUMN     "title_vi" TEXT,
ADD COLUMN     "title_zh" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "course_categories" (
    "id" SERIAL NOT NULL,
    "name_vi" TEXT,
    "name_en" TEXT,
    "name_zh" TEXT,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_rules" (
    "id" SERIAL NOT NULL,
    "antiFastForward" BOOLEAN NOT NULL DEFAULT false,
    "lockSpeed1x" BOOLEAN NOT NULL DEFAULT false,
    "showWatermark" BOOLEAN NOT NULL DEFAULT false,
    "blockDownload" BOOLEAN NOT NULL DEFAULT false,
    "requireFullCompletion" BOOLEAN NOT NULL DEFAULT false,
    "courseId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_videos" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "videoId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_categories_code_key" ON "course_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "course_rules_courseId_key" ON "course_rules"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "course_videos_courseId_videoId_key" ON "course_videos"("courseId", "videoId");

-- AddForeignKey
ALTER TABLE "course_rules" ADD CONSTRAINT "course_rules_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "course_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_videos" ADD CONSTRAINT "course_videos_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_videos" ADD CONSTRAINT "course_videos_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
