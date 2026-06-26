-- Step 1: Add academyId and parentId columns as nullable
ALTER TABLE "course_categories" ADD COLUMN "academyId" INTEGER;
ALTER TABLE "course_categories" ADD COLUMN "parentId" INTEGER;

-- Step 2: Update existing categories to have academyId = 1 (assign all to first academy)
UPDATE "course_categories" SET "academyId" = 1 WHERE "academyId" IS NULL;

-- Step 3: Set default for new inserts and make NOT NULL
ALTER TABLE "course_categories" ALTER COLUMN "academyId" SET DEFAULT 1;
ALTER TABLE "course_categories" ALTER COLUMN "academyId" SET NOT NULL;

-- Step 4: Create indexes for foreign key lookups
CREATE INDEX "course_categories_academyId_idx" ON "course_categories"("academyId");
CREATE INDEX "course_categories_parentId_idx" ON "course_categories"("parentId");

-- Step 5: Add foreign key for academy
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 6: Add foreign key for self-referencing parent
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "course_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 7: Add unique constraint for code within academy
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_code_academyId_unique" UNIQUE ("code", "academyId");
