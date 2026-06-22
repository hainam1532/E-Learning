-- CreateTable
CREATE TABLE "academies" (
    "id" SERIAL NOT NULL,
    "name_vi" TEXT,
    "name_en" TEXT,
    "name_zh" TEXT,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academy_enrollments" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "academyId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academy_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "academies_code_key" ON "academies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "academy_enrollments_userId_academyId_key" ON "academy_enrollments"("userId", "academyId");

-- AddForeignKey
ALTER TABLE "academy_enrollments" ADD CONSTRAINT "academy_enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academy_enrollments" ADD CONSTRAINT "academy_enrollments_academyId_fkey" FOREIGN KEY ("academyId") REFERENCES "academies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
