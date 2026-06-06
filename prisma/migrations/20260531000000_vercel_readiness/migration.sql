-- AlterEnum
ALTER TYPE "Platform" ADD VALUE 'AMAZON';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "password" TEXT;

-- AlterTable
ALTER TABLE "ImageProject" ADD COLUMN "targetPlatform" TEXT,
ADD COLUMN "generatedTitle" TEXT,
ADD COLUMN "generatedDescription" TEXT;

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "imageProjectId" TEXT NOT NULL,
    "productImageId" TEXT NOT NULL,
    "promptTemplateId" TEXT,
    "predictionId" TEXT,
    "engineType" TEXT NOT NULL DEFAULT 'flux',
    "status" "GenerationStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "resultUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_imageProjectId_fkey" FOREIGN KEY ("imageProjectId") REFERENCES "ImageProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_productImageId_fkey" FOREIGN KEY ("productImageId") REFERENCES "ProductImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_promptTemplateId_fkey" FOREIGN KEY ("promptTemplateId") REFERENCES "PromptTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
