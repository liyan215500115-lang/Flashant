import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hasS3Config, readObjectBuffer, uploadBuffer } from "@/lib/s3";
import { isOwnedStorageKey } from "@/lib/stored-image";
import { composePoster } from "@/lib/poster/compose";
import {
  normalizePosterCopy,
  posterFailureCode,
  posterHasType,
  posterShotEligible,
  type PosterTemplateChoice,
} from "@/lib/poster/copy";
import { posterLanguage } from "@/lib/poster/options";
import type { Prisma } from "@prisma/client";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/**
 * Redraw poster type from the stored unlettered original.
 * Does not call the image model and does not replace that original.
 * A second market is a separate poster row for the same source.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = asRecord(await req.json().catch(() => null));
    const copy = normalizePosterCopy(body.copy);
    if (!posterHasType(copy)) {
      return NextResponse.json({ error: "poster_empty" }, { status: 400 });
    }
    const template: PosterTemplateChoice = body.template === "A" || body.template === "B" || body.template === "C"
      ? body.template
      : "auto";
    const market = posterLanguage(body.market);

    const image = await db.generatedImage.findUnique({
      where: { id },
      include: { project: { select: { userId: true } } },
    });
    if (!image?.project || image.project.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let source: {
      id: string;
      imageProjectId: string;
      productImageId: string | null;
      s3Key: string;
      promptUsed: string | null;
      aiProvider: string | null;
      generationMeta: unknown;
    } = image;
    const ownMeta = asRecord(image.generationMeta);
    if (ownMeta.posterRole === "poster" && typeof ownMeta.posterSourceId === "string") {
      const original = await db.generatedImage.findUnique({ where: { id: ownMeta.posterSourceId } });
      if (!original || original.imageProjectId !== image.imageProjectId) {
        return NextResponse.json({ error: "poster_source_unavailable" }, { status: 409 });
      }
      source = original;
    }

    const sourceMeta = asRecord(source.generationMeta);
    const shotKey = typeof sourceMeta.detailKey === "string" ? sourceMeta.detailKey : undefined;
    if (!posterShotEligible(shotKey)) {
      return NextResponse.json({ error: "poster_ineligible" }, { status: 400 });
    }
    if (!isOwnedStorageKey(source.s3Key) || !hasS3Config()) {
      return NextResponse.json({ error: "poster_source_unavailable" }, { status: 409 });
    }

    let rendered: Awaited<ReturnType<typeof composePoster>>;
    try {
      const file = await readObjectBuffer(source.s3Key);
      rendered = await composePoster(file.buffer, { template, market, copy, shotKey });
    } catch (error) {
      return NextResponse.json({ error: posterFailureCode(error) }, { status: 422 });
    }
    if (!rendered) {
      return NextResponse.json({ error: "poster_empty" }, { status: 400 });
    }

    const siblings = await db.generatedImage.findMany({
      where: { imageProjectId: source.imageProjectId },
      select: { id: true, generationMeta: true },
    });
    const existing = siblings.find((row) => {
      const rowMeta = asRecord(row.generationMeta);
      return rowMeta.posterRole === "poster" && rowMeta.posterSourceId === source.id && rowMeta.market === market;
    });

    const posterMeta = {
      sourceType: sourceMeta.sourceType ?? "detail",
      detailKey: shotKey,
      posterRole: "poster",
      posterSourceId: source.id,
      unlettered: false,
      market,
      template: rendered.template,
      requestedTemplate: template,
      fallback: rendered.fallback,
      copy,
    };
    const uploaded = await uploadBuffer(rendered.buffer, "image/png", "generated/");
    if (existing) {
      await db.generatedImage.update({
        where: { id: existing.id },
        data: {
          url: uploaded.publicUrl,
          s3Key: uploaded.s3Key,
          status: "SUCCEEDED",
          errorMessage: null,
          completedAt: new Date(),
          generationMeta: posterMeta as unknown as Prisma.InputJsonValue,
        },
      });
      return NextResponse.json({
        poster: {
          id: existing.id,
          url: uploaded.publicUrl,
          sourceId: source.id,
          market,
          template: rendered.template,
          fallback: rendered.fallback,
        },
      });
    }

    const created = await db.generatedImage.create({
      data: {
        imageProjectId: source.imageProjectId,
        productImageId: source.productImageId,
        s3Key: uploaded.s3Key,
        url: uploaded.publicUrl,
        promptUsed: source.promptUsed,
        aiProvider: source.aiProvider,
        status: "SUCCEEDED",
        completedAt: new Date(),
        generationMeta: posterMeta as unknown as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({
      poster: {
        id: created.id,
        url: uploaded.publicUrl,
        sourceId: source.id,
        market,
        template: rendered.template,
        fallback: rendered.fallback,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: posterFailureCode(error) }, { status: 422 });
  }
}
