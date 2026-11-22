-- One pack click per project. Nullable on existing rows; the default keeps them unlocked.
ALTER TABLE "ImageProject" ADD COLUMN "activePackKey" TEXT;
ALTER TABLE "ImageProject" ADD COLUMN "activePackStartedAt" TIMESTAMP(3);
ALTER TABLE "ImageProject" ADD COLUMN "activePackSettled" BOOLEAN NOT NULL DEFAULT false;
