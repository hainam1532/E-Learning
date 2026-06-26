-- Create question_categories table
CREATE TABLE "question_categories" (
    "id" SERIAL NOT NULL,
    "name_vi" TEXT,
    "name_en" TEXT,
    "name_zh" TEXT,
    "description" TEXT,
    "academyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_categories_pkey" PRIMARY KEY ("id")
);

-- Create questions table
CREATE TABLE "questions" (
    "id" SERIAL NOT NULL,
    "question_vi" TEXT,
    "question_en" TEXT,
    "question_zh" TEXT,
    "type" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'MEDIUM',
    "correctAnswer" JSONB,
    "categoryId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- Create question_options table
CREATE TABLE "question_options" (
    "id" SERIAL NOT NULL,
    "option_vi" TEXT,
    "option_en" TEXT,
    "option_zh" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "questionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- Create unique index for question_categories (name_vi + academyId)
CREATE UNIQUE INDEX "question_categories_name_vi_academyId_key" ON "question_categories"("name_vi", "academyId");

-- Create indexes for questions
CREATE INDEX "questions_categoryId_idx" ON "questions"("categoryId");

-- Create indexes for question_options
CREATE INDEX "question_options_questionId_idx" ON "question_options"("questionId");

-- Add foreign key for question_categories to academies
ALTER TABLE "question_categories" ADD CONSTRAINT "question_categories_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add foreign key for questions to question_categories
ALTER TABLE "questions" ADD CONSTRAINT "questions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "question_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add foreign key for question_options to questions
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Comment for documentation
COMMENT ON TABLE "question_categories" IS 'Question bank categories';
COMMENT ON TABLE "questions" IS 'Question bank questions';
COMMENT ON TABLE "question_options" IS 'Question answer options';
