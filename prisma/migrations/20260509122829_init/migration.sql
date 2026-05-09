-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('PARSING', 'SCRIPTING', 'GENERATING_IMAGES', 'GENERATING_VIDEO', 'GENERATING_AUDIO', 'REVIEW', 'APPROVED', 'PUBLISHING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('QUEUED', 'UPLOADING', 'PROCESSING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'operator',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL DEFAULT '',
    "productImage" TEXT NOT NULL DEFAULT '',
    "script" JSONB,
    "status" "PipelineStatus" NOT NULL DEFAULT 'PARSING',
    "stageProgress" INTEGER NOT NULL DEFAULT 0,
    "estimatedRemaining" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "outputUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "videoProjectId" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "url" TEXT NOT NULL,
    "stageIndex" INTEGER NOT NULL,
    "aiProvider" TEXT,
    "generationMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishRecord" (
    "id" TEXT NOT NULL,
    "videoProjectId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'QUEUED',
    "platformPostId" TEXT,
    "platformPostUrl" TEXT,
    "errorMessage" TEXT,
    "aiLabelApplied" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAccount" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishRecord" ADD CONSTRAINT "PublishRecord_videoProjectId_fkey" FOREIGN KEY ("videoProjectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
