import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { publishToShopify } from "@/lib/platform/shopify";
import { publishToTikTokShop } from "@/lib/platform/tiktok";
import { resolvePublishImageSource } from "@/lib/publish-image";
import { getSignedGetUrl } from "@/lib/s3";
import type { Platform } from "@prisma/client";

const UNFETCHABLE = "Image is not a public URL the shop can fetch";

async function fetchableImageUrl(
  image: { id: string; url?: string | null; s3Key?: string | null; createdAt?: Date | string | null },
  origin: string,
): Promise<string | null> {
  const resolved = resolvePublishImageSource(
    {
      id: image.id,
      url: image.url,
      s3Key: image.s3Key,
      createdAt: image.createdAt instanceof Date ? image.createdAt.toISOString() : image.createdAt,
    },
    { origin, publicBaseUrl: process.env.S3_PUBLIC_URL },
  );
  if (resolved.kind === "url") return resolved.url;
  if (resolved.kind === "owned") {
    try {
      return await getSignedGetUrl(resolved.key, 3600);
    } catch {
      return null;
    }
  }
  return null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await db.platformConnection.findUnique({
    where: { userId_platform: { userId: session.user.id, platform: "SHOPIFY" } },
    select: { isActive: true, platformStoreName: true },
  });

  return NextResponse.json({
    shopifyConnected: !!(connection?.isActive && connection.platformStoreName),
    shopName: connection?.platformStoreName ?? null,
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { imageProjectId, generatedImageIds, platforms } =
    (await req.json()) as {
      imageProjectId: string;
      generatedImageIds: string[];
      platforms: Platform[];
    };

  if (!imageProjectId || !generatedImageIds?.length || !platforms?.length) {
    return NextResponse.json(
      { error: "imageProjectId, generatedImageIds, and platforms are required" },
      { status: 400 }
    );
  }

  // Verify ownership
  const project = await db.imageProject.findUnique({
    where: { id: imageProjectId },
    include: { generatedImages: true },
  });
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Update project status
  await db.imageProject.update({
    where: { id: imageProjectId },
    data: { status: "PUBLISHING" },
  });

  const results: {
    platform: Platform;
    status: "published" | "failed";
    postId?: string;
    postUrl?: string;
    error?: string;
  }[] = [];

  for (const platform of platforms) {
    for (const imageId of generatedImageIds) {
      const genImage = project.generatedImages.find(
        (g) => g.id === imageId
      );
      if (!genImage || genImage.status !== "SUCCEEDED") continue;

      try {
        let result: { postId: string; postUrl: string } | null = null;

        if (platform === "SHOPIFY" || platform === "TIKTOK_SHOP") {
          const src = await fetchableImageUrl(genImage, new URL(req.url).origin);
          if (!src) {
            await db.publishRecord.create({
              data: {
                imageProjectId,
                generatedImageId: genImage.id,
                platform,
                status: "FAILED",
                errorMessage: UNFETCHABLE,
              },
            });
            results.push({ platform, status: "failed", error: UNFETCHABLE });
            continue;
          }
          const payload = {
            title: project.title || "Product Image",
            images: [{ url: src }],
          };
          result = platform === "SHOPIFY"
            ? await publishToShopify(userId, payload)
            : await publishToTikTokShop(userId, payload);
        } else {
          results.push({
            platform,
            status: "failed",
            error: `${platform} not supported in Phase 1a`,
          });
          continue;
        }

        if (result) {
          await db.publishRecord.create({
            data: {
              imageProjectId,
              generatedImageId: genImage.id,
              platform,
              status: "PUBLISHED",
              platformPostId: result.postId,
              platformPostUrl: result.postUrl,
              publishedAt: new Date(),
            },
          });
          results.push({
            platform,
            status: "published",
            postId: result.postId,
            postUrl: result.postUrl,
          });
        } else {
          await db.publishRecord.create({
            data: {
              imageProjectId,
              generatedImageId: genImage.id,
              platform,
              status: "FAILED",
              errorMessage: "Token expired or not connected",
            },
          });
          results.push({
            platform,
            status: "failed",
            error: "Token expired or not connected",
          });
        }
      } catch (error) {
        await db.publishRecord.create({
          data: {
            imageProjectId,
            generatedImageId: genImage.id,
            platform,
            status: "FAILED",
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
          },
        });
        results.push({
          platform,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  // Update project status
  const hasPublished = results.some((r) => r.status === "published");
  await db.imageProject.update({
    where: { id: imageProjectId },
    data: { status: hasPublished ? "PUBLISHED" : "APPROVED" },
  });

  return NextResponse.json({ results });
}
