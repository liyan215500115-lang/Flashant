import { describe, expect, it } from "vitest";
import { resolvePublishImageSource } from "@/lib/publish-image";

const NOW = Date.parse("2026-11-28T12:00:00.000Z");
const ORIGIN = "https://flashant.test";

describe("publish image source", () => {
  it("keeps a fresh public https URL", () => {
    expect(resolvePublishImageSource({
      id: "img_1",
      url: "https://cdn.example/shot.png",
      s3Key: "https://cdn.example/shot.png",
      createdAt: "2026-11-28T11:30:00.000Z",
    }, { origin: ORIGIN, now: NOW })).toEqual({
      kind: "url",
      url: "https://cdn.example/shot.png",
    });
  });

  it("does not treat an expired provider URL as publishable", () => {
    expect(resolvePublishImageSource({
      id: "img_old",
      url: "https://replicate.delivery/pbxt/old.png",
      s3Key: "https://replicate.delivery/pbxt/old.png",
      createdAt: "2026-11-28T08:00:00.000Z",
    }, { origin: ORIGIN, now: NOW })).toEqual({
      kind: "unavailable",
      reason: "expired",
    });
  });

  it("uses the public object URL for an owned key when a public base is configured", () => {
    expect(resolvePublishImageSource({
      id: "img_owned",
      url: "https://replicate.delivery/pbxt/old.png",
      s3Key: "generated/lifestyle.png",
      createdAt: "2026-11-20T00:00:00.000Z",
    }, { origin: ORIGIN, publicBaseUrl: "https://cdn.flashant.test/", now: NOW })).toEqual({
      kind: "url",
      url: "https://cdn.flashant.test/generated/lifestyle.png",
    });
  });

  it("asks the caller to sign a private owned key instead of sending the key or the file route", () => {
    const resolved = resolvePublishImageSource({
      id: "img_owned",
      url: "/api/generated-images/img_owned/file",
      s3Key: "generated/lifestyle.png",
    }, { origin: ORIGIN, publicBaseUrl: "", now: NOW });
    expect(resolved).toEqual({ kind: "owned", key: "generated/lifestyle.png" });
    expect(JSON.stringify(resolved)).not.toContain("/api/generated-images/");
  });

  it("absolutizes a local public file", () => {
    expect(resolvePublishImageSource({
      id: "img_local",
      url: "/generated/shot.png",
      s3Key: "/generated/shot.png",
    }, { origin: ORIGIN, now: NOW })).toEqual({
      kind: "url",
      url: "https://flashant.test/generated/shot.png",
    });
  });
});
