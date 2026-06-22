-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "status" "VideoStatus" NOT NULL DEFAULT 'PROCESSING';
