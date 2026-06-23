-- CreateTable
CREATE TABLE "training_classes" (
    "id" SERIAL NOT NULL,
    "name_vi" TEXT,
    "name_en" TEXT,
    "name_zh" TEXT,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "academyId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plans" (
    "id" SERIAL NOT NULL,
    "title_vi" TEXT,
    "title_en" TEXT,
    "title_zh" TEXT,
    "description_vi" TEXT,
    "description_en" TEXT,
    "description_zh" TEXT,
    "coverImage" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "academyId" INTEGER,
    "trainingClassId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_resources" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "refId" INTEGER NOT NULL,
    "title_vi" TEXT,
    "title_en" TEXT,
    "title_zh" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "trainingPlanId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "training_classes_code_key" ON "training_classes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "training_resources_trainingPlanId_refId_key" ON "training_resources"("trainingPlanId", "refId");

-- AddForeignKey
ALTER TABLE "training_classes" ADD CONSTRAINT "training_classes_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_trainingClassId_fkey" FOREIGN KEY ("trainingClassId") REFERENCES "training_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_resources" ADD CONSTRAINT "training_resources_trainingPlanId_fkey" FOREIGN KEY ("trainingPlanId") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
