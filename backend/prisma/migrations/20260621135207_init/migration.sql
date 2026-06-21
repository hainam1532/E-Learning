/*
  Warnings:

  - A unique constraint covering the columns `[usercode]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `usercode` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "usercode" TEXT NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_usercode_key" ON "users"("usercode");
