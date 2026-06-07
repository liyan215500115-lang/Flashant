import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSocksFetch } from "@/lib/ai/socks-fetch";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { imageUrl, productName, sellingPoints, sceneMode } = await req.json();
  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  }

  const sceneLabels: Record<string, string> = {
    scene: "in a clean bright natural setting with premium studio lighting",
    white_bg: "on a pure white infinity background with soft even studio lighting",
    model: "worn by a lifestyle model in natural ambient light, candid editorial style",
  };
  const scene = sceneLabels[sceneMode] ?? sceneLabels.scene;
  const name = productName || "product";
  const points = sellingPoints ? `, highlighting: ${sellingPoints}` : "";

  // Try DeepSeek first, then OpenAI, then template fallback
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const llmApiKey = deepseekKey || (openaiKey && openaiKey !== "your-openai-api-key" ? openaiKey : null);
  const llmBaseURL = deepseekKey ? "https://api.deepseek.com" : "https://api.openai.com/v1";
  const llmModel = deepseekKey ? "deepseek-chat" : "gpt-4o-mini";

  if (llmApiKey) {
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({
        apiKey: llmApiKey,
        baseURL: llmBaseURL,
        fetch: createSocksFetch(),
      });

      const content: Array<{ type: "text" | "image_url"; text?: string; image_url?: { url: string } }> = [
        { type: "text", text: `Analyze this product image and generate a professional e-commerce product photography prompt.

Product name: ${name}
Scene: ${scene}${points}

Describe what you see: the product category, key materials, colors, textures, and unique features. Then output a single detailed English prompt for AI image generation that would make this product look premium and commercial-grade. Focus on lighting, composition, and atmosphere.

Output ONLY the final English prompt — no explanations, no Chinese.` },
        { type: "image_url", image_url: { url: imageUrl } },
      ];

      const response = await client.chat.completions.create({
        model: llmModel,
        messages: [{ role: "user", content } as any],
        temperature: 0.7,
        max_tokens: 200,
      });

      const enhanced = response.choices[0]?.message?.content?.trim();
      if (enhanced) {
        return NextResponse.json({ enhanced });
      }
    } catch {
      // Fall back to template-based enhancement
    }
  }

  // Template-based enhancement (no external model needed)
  const enhanced = `Professional product photography of ${name}${points}. ${name.charAt(0).toUpperCase() + name.slice(1)} ${scene}, commercial quality, 8K resolution, sharp focus, premium advertising aesthetic, product-centered composition.`;

  return NextResponse.json({ enhanced });
}
