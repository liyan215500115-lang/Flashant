import { describe, expect, it } from "vitest";
import picomatch from "next/dist/compiled/picomatch";
import nextConfig from "../../next.config";
import { FONT_TRACE_INCLUDES } from "@/lib/font-trace-includes";
import { POSTER_FONT_FACES } from "@/lib/poster/fonts";

function resolvedConfig(): { outputFileTracingIncludes?: Record<string, readonly string[]> } {
  if (typeof nextConfig === "function") {
    throw new Error("next.config default export should be an object");
  }
  return nextConfig;
}

describe("font file tracing", () => {
  it("attaches the runtime font set to generate and poster re-overlay", () => {
    const includes = resolvedConfig().outputFileTracingIncludes;
    expect(includes).toEqual(FONT_TRACE_INCLUDES);

    const generate = includes?.["/api/generate"] ?? [];
    const reoverlay = includes?.["/api/generated-images/[id]/poster"] ?? [];
    const expected = POSTER_FONT_FACES.map((face) => `./assets/fonts/${face.file}`);

    expect(generate).toEqual(expect.arrayContaining(expected));
    expect(reoverlay).toEqual(expect.arrayContaining(expected));
    expect(reoverlay).toEqual(expect.arrayContaining([
      "./assets/fonts/NotoSansCJKsc-Bold.otf",
      "./assets/fonts/NotoSansCJKsc-Regular.otf",
      "./assets/fonts/NotoSans-Regular.ttf",
      "./assets/fonts/DroidSansFallbackFull.ttf",
    ]));

    const match = (pattern: string, route: string) => picomatch(pattern, { dot: true, contains: true })(route);
    expect(match("/api/generate", "/api/generate")).toBe(true);
    expect(match("/api/generated-images/[id]/poster", "/api/generated-images/[id]/poster")).toBe(true);
  });
});
