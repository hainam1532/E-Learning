-- Create documents table
CREATE TABLE IF NOT EXISTS "documents" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bucket" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- Create index for faster queries
CREATE INDEX "documents_id_idx" ON "documents"("id");

-- Comment for documentation
COMMENT ON TABLE "documents" IS 'Document library table for storing Excel, Word, PDF, PowerPoint files in MinIO';
