import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import zh from "../../messages/zh.json";
import {
  displayForGeneratedImage,
  generationCompletionBanner,
  generationStatusText,
} from "@/lib/generated-image-display";
import { translate } from "@/lib/translate";

const NOW = Date.parse("2026-11-28T13:00:00.000Z");
const JUNE = "2026-06-13T10:20:00.000Z";

function expiredShots(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `old_${index}`,
    status: "SUCCEEDED",
    url: `https://replicate.delivery/pbxt/old-${index}.png`,
    s3Key: `https://replicate.delivery/pbxt/old-${index}.png`,
    createdAt: JUNE,
  }));
}

describe("historical generated image display", () => {
  it("does not call an expired provider URL complete, and says the files are unavailable", () => {
    const images = expiredShots(7);
    const banner = generationCompletionBanner({
      projectStatus: "GENERATED",
      images,
      now: NOW,
    });
    expect(banner.kind).toBe("unavailable");
    expect(banner.unavailable).toBe(7);
    expect(banner.ready).toBe(0);

    const enText = generationStatusText(banner, (key) => translate(en, key));
    const zhText = generationStatusText(banner, (key) => translate(zh, key));
    expect(enText).toBe("Generation finished, but 7 image files are no longer available");
    expect(zhText).toBe("生成已完成，但 7 张图片文件已失效，无法显示");
    expect(enText).not.toContain("product images ready");
    expect(zhText).not.toContain("张商品图已就绪");
    for (const image of images) {
      expect(displayForGeneratedImage(image, NOW).src).toBeNull();
    }
  });

  it("treats a load failure of a still-listed provider URL as unavailable rather than ready", () => {
    const images = expiredShots(7).map((image) => ({ ...image, createdAt: new Date(NOW - 60_000).toISOString() }));
    const pending = generationCompletionBanner({
      projectStatus: "GENERATED",
      images,
      now: NOW,
    });
    expect(pending.kind).not.toBe("complete");
    expect(generationStatusText(pending, (key) => translate(en, key))).toBeNull();

    const broken = generationCompletionBanner({
      projectStatus: "GENERATED",
      images,
      brokenIds: new Set(images.map((image) => image.id)),
      now: NOW,
    });
    expect(broken.kind).toBe("unavailable");
    expect(generationStatusText(broken, (key) => translate(en, key))).toContain("no longer available");
    expect(generationStatusText(broken, (key) => translate(en, key))).not.toContain("All generations complete");
  });

  it("treats a signed COS link past its own expiry as unloadable", () => {
    const image = {
      id: "cos_1",
      status: "SUCCEEDED",
      url: "https://bucket.cos.ap-shanghai.myqcloud.com/vega.png?q-sign-time=1718000000;1718003600",
      s3Key: "https://bucket.cos.ap-shanghai.myqcloud.com/vega.png?q-sign-time=1718000000;1718003600",
      createdAt: JUNE,
    };
    expect(displayForGeneratedImage(image, NOW).src).toBeNull();
    const banner = generationCompletionBanner({
      projectStatus: "GENERATED",
      images: [image],
      now: NOW,
    });
    expect(banner.kind).toBe("unavailable");
  });

  it("shows a stored copy through the file route even when the saved URL is an expired provider link", () => {
    const image = {
      id: "kept_1",
      status: "SUCCEEDED",
      url: "https://replicate.delivery/pbxt/old.png",
      s3Key: "generated/kept.png",
      createdAt: JUNE,
    };
    const display = displayForGeneratedImage(image, NOW);
    expect(display.durable).toBe(true);
    expect(display.src).toBe("/api/generated-images/kept_1/file");
    const banner = generationCompletionBanner({
      projectStatus: "GENERATED",
      images: [image],
      now: NOW,
    });
    expect(banner.kind).toBe("complete");
    expect(generationStatusText(banner, (key) => translate(en, key))).toBe(
      "All generations complete — 1 product images ready",
    );
  });

  it("recovers a public storage URL whose path still names our object", () => {
    const image = {
      id: "cdn_1",
      status: "SUCCEEDED",
      url: "https://cdn.example.com/generated/cdn-shot.png",
      s3Key: "https://cdn.example.com/generated/cdn-shot.png",
      createdAt: JUNE,
    };
    expect(displayForGeneratedImage(image, NOW).src).toBe("/api/generated-images/cdn_1/file");
  });
});
