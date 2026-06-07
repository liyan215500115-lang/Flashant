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
        fetch: isProd ? undefined : createSocksFetch(), // SOCKS only for local dev
      });

      const response = await client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a senior e-commerce visual marketing expert, specialized in writing high-quality product image prompts for AI image generation models (FLUX.2 Pro, Midjourney, SDXL). Your task is to output a professional, detailed English prompt ready for image generation, along with a Chinese explanation.

### Output Format:
1. **Prompt**: An English prompt for FLUX.2 Pro / SDXL, including:
   - Product: name, material, color, key details
   - Background: specific material, color, atmosphere
   - Lighting: natural/studio/side/back light
   - Quality: 8K, high resolution, sharp focus
   - Style: commercial photography, product photography, clean background
   - Optional: camera angle (top-down/eye-level/macro)

2. **Negative Prompt**: Avoid low quality, deformation, watermark, etc.

3. **中文说明**: Briefly explain why this prompt works.

### Example:
Input: ceramic mug, matte white, wooden table, warm feel
Output:
**Prompt**: Professional product photography of a handmade ceramic mug, matte white glaze, placed on a rustic wooden table with blurred green plant background, natural window light from left, soft shadows, warm cozy atmosphere, 8K, sharp focus, commercial lighting, clean background.
**Negative**: deformed, ugly, blurry, low quality, watermark, text, cropped, harsh shadows, overexposed.
**说明**: 强调材质哑光感和侧光营造温馨氛围，自然虚化背景避免杂乱。

Follow this format strictly. Output ONLY prompt-related content, no extra commentary.",
          },
          {
            role: "user",
            content: `Product: ${name}. ${points}. Scene: ${scene}.${targetLanguage === "zh" ? " Output in Chinese." : targetLanguage ? ` Output in ${targetLanguage} language.` : " Output in English."}`
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
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
