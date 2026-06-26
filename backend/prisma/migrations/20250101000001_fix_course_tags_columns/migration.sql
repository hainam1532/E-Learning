-- Fix column naming for course_tags to match Prisma schema (camelCase)
-- The initial migration used snake_case but Prisma expects camelCase

-- Rename created_at to createdAt
ALTER TABLE "course_tags" RENAME COLUMN "created_at" TO "createdAt";

-- Rename updated_at to updatedAt
ALTER TABLE "course_tags" RENAME COLUMN "updated_at" TO "updatedAt";
