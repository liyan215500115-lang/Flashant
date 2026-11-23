import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadUrl } from "@/lib/download-image";

describe("downloadUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not navigate the page when the image fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    const clicks: string[] = [];
    const original = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = original(tag);
      if (tag.toLowerCase() === "a") {
        el.click = () => {
          clicks.push((el as HTMLAnchorElement).href);
        };
      }
      return el;
    });

    const ok = await downloadUrl("https://provider.example/original.png", "shot.png");
    expect(ok).toBe(false);
    expect(clicks).toEqual([]);
    expect(document.body.innerHTML).not.toContain("provider.example");
  });

  it("saves a blob and does not point a link at the provider URL", async () => {
    const blob = new Blob([Uint8Array.from([1, 2, 3, 4])], { type: "image/png" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(blob)));
    const createObjectURL = vi.fn(() => "blob:flashant-shot");
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL: () => {},
    });
    const clicks: string[] = [];
    const original = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = original(tag);
      if (tag.toLowerCase() === "a") {
        el.click = () => {
          clicks.push((el as HTMLAnchorElement).href);
        };
      }
      return el;
    });

    const ok = await downloadUrl("https://provider.example/original.png", "shot.png");
    expect(ok).toBe(true);
    expect(clicks).toEqual(["blob:flashant-shot"]);
    expect(clicks.join(" ")).not.toContain("provider.example");
  });

  it("does not navigate when the file route closes or refuses the image", async () => {
    const clicks: string[] = [];
    const original = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = original(tag);
      if (tag.toLowerCase() === "a") {
        el.click = () => {
          clicks.push((el as HTMLAnchorElement).href);
        };
      }
      return el;
    });

    const fileUrl = "/api/generated-images/old-lifestyle/file";
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }));
    expect(await downloadUrl(fileUrl, "flashant-old-lif.png")).toBe(false);

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Image is not in storage" }), { status: 409 })));
    expect(await downloadUrl(fileUrl, "flashant-old-lif.png")).toBe(false);

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Image could not be read" }), { status: 502 })));
    expect(await downloadUrl(fileUrl, "flashant-old-lif.png")).toBe(false);

    expect(clicks).toEqual([]);
    expect(document.body.innerHTML).not.toContain(fileUrl);
  });
});
