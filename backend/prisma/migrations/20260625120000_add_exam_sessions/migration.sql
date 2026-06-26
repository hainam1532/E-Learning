-- CreateTable
CREATE TABLE "exam_sessions" (
    "id" SERIAL NOT NULL,
    "name_vi" TEXT NOT NULL,
    "name_en" TEXT,
    "name_zh" TEXT,
    "academyId" INTEGER NOT NULL,
    "paperCategoryId" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "attemptLimit" INTEGER NOT NULL DEFAULT 1,
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "antiCheat" BOOLEAN NOT NULL DEFAULT true,
    "requireFullscreen" BOOLEAN NOT NULL DEFAULT true,
    "detectTabSwitch" BOOLEAN NOT NULL DEFAULT true,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_sessions_academyId_idx" ON "exam_sessions"("academyId");

-- CreateIndex
CREATE INDEX "exam_sessions_paperCategoryId_idx" ON "exam_sessions"("paperCategoryId");

-- AddForeignKey
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_paperCategoryId_fkey" FOREIGN KEY ("paperCategoryId") REFERENCES "question_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
