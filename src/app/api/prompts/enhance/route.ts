import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSocksFetch } from "@/lib/ai/socks-fetch";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { imageUrl, productName, sellingPoints, sceneMode, targetLanguage } = await req.json();
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
  const lang = targetLanguage || "en";

  // Try DeepSeek (text-only), OpenAI (vision if configured), then template fallback
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (deepseekKey) {
    try {
      const OpenAI = (await import("openai")).default;
      const isProd = process.env.NODE_ENV === "production";
      const client = new OpenAI({
        apiKey: deepseekKey,
        baseURL: "https://api.deepseek.com",
        fetch: isProd ? undefined : createSocksFetch(),
      });

      const systemPrompt = `You are a senior e-commerce visual marketing expert, specialized in writing high-quality product image prompts for AI image generation models (FLUX.2 Pro, Midjourney, SDXL).

## Output ONLY in ${lang === "zh" ? "Chinese" : lang === "es" ? "Spanish" : lang === "ja" ? "Japanese" : "English"}:
1. A detailed image generation prompt including: product name, material, color, details, background, lighting, composition, quality (8K), photography style
2. A negative prompt: avoid low quality, deformed, blurry, watermark, text
3. A brief explanation of why this prompt works

## Rules:
- Keep the prompt under 200 characters
- Use professional product photography terminology
- Optimize for ${lang === "zh" ? "Chinese e-commerce platforms" : "global e-commerce platforms"}`;

      const response = await client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Product: ${name}.${points}. Scene: ${scene}.` },
        ],
        temperature: 0.7,
        max_tokens: 300,
      });

      const enhanced = response.choices[0]?.message?.content?.trim();
      if (enhanced) return NextResponse.json({ enhanced });
    } catch {
      // Fall back to template
    }
  }

  if (openaiKey && openaiKey !== "your-openai-api-key") {
    try {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: openaiKey, fetch: createSocksFetch() });

      const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
        { type: "text", text: `Analyze this product image and generate a professional e-commerce product photography prompt. Product: ${name}. Scene: ${scene}${points}. Describe what you see and output a single detailed English prompt.` },
        { type: "image_url", image_url: { url: imageUrl } },
      ];

      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content } as any],
        temperature: 0.7,
        max_tokens: 200,
      });

      const enhanced = response.choices[0]?.message?.content?.trim();
      if (enhanced) return NextResponse.json({ enhanced });
    } catch {
      // Fall back to template
    }
  }

  // Template-based enhancement (no external model needed)
  const enhanced = `Professional product photography of ${name}${points}. ${name.charAt(0).toUpperCase() + name.slice(1)} ${scene}, commercial quality, 8K resolution, sharp focus, premium advertising aesthetic, product-centered composition.`;

  return NextResponse.json({ enhanced });
}
