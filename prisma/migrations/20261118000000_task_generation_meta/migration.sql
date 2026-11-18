-- Additive. Existing task rows stay valid; the column is nullable.
ALTER TABLE "Task" ADD COLUMN "generationMeta" JSONB;
