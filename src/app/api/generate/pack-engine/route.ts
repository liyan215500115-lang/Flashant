import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProvider } from "@/lib/ai/registry";
import { configuredVegaImageModel, isTencentVegaConfigured } from "@/lib/ai/tencent-vega";
import { packWorkbenchEngine } from "@/lib/generate/pack-engine";

/**
 * The pack engine the workbench should show before a shot runs.
 * Returns a model id only. Never the TokenHub key or base URL.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configured = isTencentVegaConfigured();
  let providerModel = "";
  if (configured) {
    try {
      const provider = getProvider("vega") as { model?: string };
      providerModel = typeof provider.model === "string" ? provider.model.trim() : "";
    } catch {
      providerModel = "";
    }
  }

  const selection = packWorkbenchEngine({
    vegaConfigured: configured,
    providerModel,
    configuredModel: configured ? configuredVegaImageModel() : "",
  });

  return NextResponse.json({
    engine: selection.engine,
    modelVersion: selection.engine === "vega" ? selection.label : null,
  });
}
