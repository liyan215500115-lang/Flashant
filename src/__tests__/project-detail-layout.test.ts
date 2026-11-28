import { describe, expect, it } from "vitest";
import {
  continuePlacement,
  emptyPlacement,
  galleryColumns,
  headerActionState,
  shotSummary,
  statusPill,
} from "@/lib/project-detail-layout";

describe("project detail layout", () => {
  it("counts only successful generated images in the shot summary", () => {
    expect(shotSummary(0, 0)).toBe("empty");
    expect(shotSummary(1, 0)).toBe("source");
    expect(shotSummary(1, 2)).toBe("mixed");
    expect(shotSummary(0, 2)).toBe("generated");
  });

  it("uses a bar when continue-generating would sit alone, and a tile when it fits", () => {
    expect(continuePlacement({ selecting: false, generatedCount: 2, tileCount: 3, columns: 3 })).toBe("bar");
    expect(continuePlacement({ selecting: false, generatedCount: 4, tileCount: 5, columns: 3 })).toBe("tile");
    expect(continuePlacement({ selecting: true, generatedCount: 2, tileCount: 3, columns: 3 })).toBe("none");
    expect(continuePlacement({ selecting: false, generatedCount: 0, tileCount: 1, columns: 2 })).toBe("none");
    expect(continuePlacement({ selecting: false, generatedCount: 2, tileCount: 3, columns: 1 })).toBe("bar");
  });

  it("pairs one original with the explanation and stacks a full empty project", () => {
    expect(galleryColumns({ viewport: "wide", tileCount: 1, sourceOnly: true })).toBe(2);
    expect(galleryColumns({ viewport: "phone", tileCount: 1, sourceOnly: true })).toBe(1);
    expect(galleryColumns({ viewport: "wide", tileCount: 5, sourceOnly: false })).toBe(3);
    expect(galleryColumns({ viewport: "narrow", tileCount: 5, sourceOnly: false })).toBe(2);
    expect(emptyPlacement({ originalCount: 1, generatedCount: 0, columns: 2 })).toBe("beside");
    expect(emptyPlacement({ originalCount: 0, generatedCount: 0, columns: 2 })).toBe("full");
    expect(emptyPlacement({ originalCount: 1, generatedCount: 2, columns: 3 })).toBe("none");
  });

  it("keeps download as the only solid primary when a shot can be saved", () => {
    expect(headerActionState({ downloadableCount: 2, originalCount: 1, generatedCount: 2 })).toEqual({
      downloadEnabled: true,
      publishEnabled: true,
      primary: "download",
      selectEnabled: true,
      deleteEnabled: true,
    });
    expect(headerActionState({ downloadableCount: 0, originalCount: 1, generatedCount: 0 })).toMatchObject({
      downloadEnabled: false,
      publishEnabled: false,
      primary: "studio",
      selectEnabled: true,
      deleteEnabled: true,
    });
    expect(headerActionState({ downloadableCount: 0, originalCount: 0, generatedCount: 0 })).toMatchObject({
      downloadEnabled: false,
      publishEnabled: false,
      primary: "studio",
      selectEnabled: false,
      deleteEnabled: true,
    });
  });

  it("hides the status pill while loading and uses 未生成 until a shot succeeds", () => {
    expect(statusPill({ loading: true, generatedCount: 2 })).toBeNull();
    expect(statusPill({ loading: false, generatedCount: 0 })).toBe("pending");
    expect(statusPill({ loading: false, generatedCount: 1 })).toBe("generated");
  });
});
