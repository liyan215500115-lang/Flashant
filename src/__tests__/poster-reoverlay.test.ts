import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const { uploadBuffer, readObjectBuffer, getProvider } = vi.hoisted(() => ({
  uploadBuffer: vi.fn(),
  readObjectBuffer: vi.fn(),
  getProvider: vi.fn(() => {
    throw new Error("model_should_not_run");
  }),
}));

vi.mock("@/lib/ai/registry", () => ({ getProvider }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "user_1" } })) }));
vi.mock("@/lib/s3", () => ({
  hasS3Config: () => true,
  readObjectBuffer,
  uploadBuffer,
}));
vi.mock("@/lib/db", () => ({
  db: {
    generatedImage: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(async () => ({ id: "poster_en" })),
      update: vi.fn(async () => ({})),
    },
  },
}));

import { POST } from "@/app/api/generated-images/[id]/poster/route";
import { db } from "@/lib/db";

async function sourcePng(): Promise<Buffer> {
  return sharp({
    create: { width: 240, height: 240, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();
}

beforeEach(() => {
  vi.clearAllMocks();
  readObjectBuffer.mockImplementation(async () => ({ buffer: await sourcePng(), contentType: "image/png" }));
  uploadBuffer.mockResolvedValue({ s3Key: "generated/poster-en.png", publicUrl: "https://cdn.example/poster-en.png" });
  vi.mocked(db.generatedImage.findUnique).mockResolvedValue({
    id: "gen_original",
    imageProjectId: "proj_1",
    productImageId: "img_1",
    s3Key: "generated/original.png",
    url: "https://cdn.example/original.png",
    promptUsed: "unlettered",
    aiProvider: "openai",
    generationMeta: { sourceType: "detail", detailKey: "selling_points", posterRole: "original", unlettered: true },
    project: { userId: "user_1" },
  } as never);
  vi.mocked(db.generatedImage.findMany).mockResolvedValue([] as never);
});

describe("poster re-overlay", () => {
  it("redraws from the stored original and does not run the model", async () => {
    const first = await POST(new Request("http://localhost/api/generated-images/gen_original/poster", {
      method: "POST",
      body: JSON.stringify({
        template: "B",
        market: "zh",
        copy: { title: "中文标题", series: "AMBER" },
      }),
    }), { params: Promise.resolve({ id: "gen_original" }) });
    expect(first.status).toBe(200);
    const firstJson = await first.json();
    expect(firstJson.poster.sourceId).toBe("gen_original");
    expect(firstJson.poster.market).toBe("zh");
    expect(getProvider).not.toHaveBeenCalled();

    vi.mocked(db.generatedImage.findMany).mockResolvedValue([{
      id: "poster_zh",
      generationMeta: { posterRole: "poster", posterSourceId: "gen_original", market: "zh" },
    }] as never);
    const second = await POST(new Request("http://localhost/api/generated-images/gen_original/poster", {
      method: "POST",
      body: JSON.stringify({
        template: "B",
        market: "en",
        copy: { title: "English title", series: "AMBER" },
      }),
    }), { params: Promise.resolve({ id: "gen_original" }) });
    const secondJson = await second.json();
    expect(second.status).toBe(200);
    expect(secondJson.poster.market).toBe("en");
    expect(secondJson.poster.id).toBe("poster_en");
    expect(getProvider).not.toHaveBeenCalled();

    const updates = vi.mocked(db.generatedImage.update).mock.calls.map((call) => call[0]);
    expect(updates.every((call) => call.where.id !== "gen_original")).toBe(true);
    const created = vi.mocked(db.generatedImage.create).mock.calls.map((call) => call[0].data);
    expect(created.every((row) => row.generationMeta?.posterSourceId === "gen_original")).toBe(true);
    expect(created.some((row) => row.generationMeta?.market === "en" && row.generationMeta?.copy?.title === "English title")).toBe(true);
  });

  it("fails closed on a missing glyph and leaves the original untouched", async () => {
    const res = await POST(new Request("http://localhost/api/generated-images/gen_original/poster", {
      method: "POST",
      body: JSON.stringify({ market: "en", template: "B", copy: { title: "Bottle \uE000" } }),
    }), { params: Promise.resolve({ id: "gen_original" }) });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: "caption_glyphs_missing" });
    expect(uploadBuffer).not.toHaveBeenCalled();
    expect(db.generatedImage.update).not.toHaveBeenCalled();
    expect(db.generatedImage.create).not.toHaveBeenCalled();
    expect(getProvider).not.toHaveBeenCalled();
  });
});
