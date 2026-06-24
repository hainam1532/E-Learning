-- Add extra fields to training_classes table
ALTER TABLE "training_classes" ADD COLUMN IF NOT EXISTS "description_vi" TEXT;
ALTER TABLE "training_classes" ADD COLUMN IF NOT EXISTS "description_en" TEXT;
ALTER TABLE "training_classes" ADD COLUMN IF NOT EXISTS "description_zh" TEXT;
ALTER TABLE "training_classes" ADD COLUMN IF NOT EXISTS "content_vi" TEXT;
ALTER TABLE "training_classes" ADD COLUMN IF NOT EXISTS "content_en" TEXT;
ALTER TABLE "training_classes" ADD COLUMN IF NOT EXISTS "content_zh" TEXT;
ALTER TABLE "training_classes" ADD COLUMN IF NOT EXISTS "objectives_vi" TEXT;
ALTER TABLE "training_classes" ADD COLUMN IF NOT EXISTS "objectives_en" TEXT;
ALTER TABLE "training_classes" ADD COLUMN IF NOT EXISTS "objectives_zh" TEXT;
ALTER TABLE "training_classes" ADD COLUMN IF NOT EXISTS "targetAudience" TEXT;
ALTER TABLE "training_classes" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "training_classes" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
ALTER TABLE "training_classes" ADD COLUMN IF NOT EXISTS "lecturerId" INTEGER;

-- Add foreign key for lecturer
ALTER TABLE "training_classes" ADD CONSTRAINT "training_classes_lecturerId_fkey" 
  FOREIGN KEY ("lecturerId") REFERENCES "lecturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
