-- Documents table for uploaded files and stored docs
CREATE TABLE IF NOT EXISTS "document" (
  "id" SERIAL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "category" TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT,
  "size" INTEGER,
  "data" TEXT NOT NULL,
  "source" TEXT DEFAULT 'upload',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
