/**
 * What the workbench selector shows for a recommended pack before any shot runs.
 * The model id is a public model name, never an API key or base URL.
 */
export function packWorkbenchEngine(input: {
  vegaConfigured: boolean;
  providerModel?: string | null;
  configuredModel?: string | null;
}): { engine: "vega" | "flux"; label: string } {
  if (!input.vegaConfigured) return { engine: "flux", label: "" };
  const fromProvider = input.providerModel?.trim() || "";
  const fromConfig = input.configuredModel?.trim() || "";
  return { engine: "vega", label: fromProvider || fromConfig || "wand-vega-image-1.5-pro" };
}

/**
 * Showing Vega for the pack must not switch the single-image request off flux
 * unless the user actually picks an engine.
 */
export function singleImageEngineType(input: {
  selectedEngine: string;
  packEngineAutoSelected: boolean;
  userChoseEngine: boolean;
}): string {
  if (input.packEngineAutoSelected && !input.userChoseEngine) return "flux";
  const selected = input.selectedEngine.trim();
  return selected || "flux";
}
