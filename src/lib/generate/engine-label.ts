export interface ShotEngineRow {
  aiProvider?: string | null;
  modelVersion?: string | null;
}

/**
 * The workbench selector follows the engine that actually ran the pack.
 * A Vega shot is labeled with its model id, never the FLUX.2 Pro option.
 */
export function workbenchEngineFromShots(shots: readonly ShotEngineRow[]): {
  engine: "vega" | "flux";
  label: string;
} {
  const vega = shots.find((shot) => shot.aiProvider === "vega");
  if (!vega) return { engine: "flux", label: "" };
  const model = vega.modelVersion?.trim() || "Vega";
  return { engine: "vega", label: model };
}

export function workbenchEngineOptionLabel(input: {
  engine: string;
  vegaLabel?: string | null;
  fluxLabel: string;
}): string {
  if (input.engine === "vega") {
    const label = input.vegaLabel?.trim() || "Vega";
    return label;
  }
  return input.fluxLabel;
}
