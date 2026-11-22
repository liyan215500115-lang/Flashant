import { describe, expect, it } from "vitest";
import { workbenchEngineFromShots, workbenchEngineOptionLabel } from "@/lib/generate/engine-label";

const FLUX = "FLUX.2 Pro（推荐）";

describe("workbench engine label", () => {
  it("labels a Vega pack with the model that was called", () => {
    const selection = workbenchEngineFromShots([
      { aiProvider: "vega", modelVersion: "wand-vega-image-1.5-pro" },
      { aiProvider: "vega", modelVersion: "wand-vega-image-1.5-pro" },
    ]);
    expect(selection).toEqual({ engine: "vega", label: "wand-vega-image-1.5-pro" });
    const shown = workbenchEngineOptionLabel({
      engine: selection.engine,
      vegaLabel: selection.label,
      fluxLabel: FLUX,
    });
    expect(shown).toBe("wand-vega-image-1.5-pro");
    expect(shown).not.toContain("FLUX.2");
    expect(shown).not.toContain("推荐");
  });

  it("keeps the flux label when the shot did not use Vega", () => {
    const selection = workbenchEngineFromShots([
      { aiProvider: "flux", modelVersion: "black-forest-labs/flux-2-pro" },
    ]);
    expect(selection.engine).toBe("flux");
    expect(workbenchEngineOptionLabel({
      engine: "flux",
      vegaLabel: selection.label,
      fluxLabel: FLUX,
    })).toBe(FLUX);
  });
});
