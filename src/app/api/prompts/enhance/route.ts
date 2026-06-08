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
  const name = productName || "product";
  const points = sellingPoints || "";
  const lang = targetLanguage || "en";

  // Scene descriptions
  const scenes: Record<string, string> = {
    scene: "placed in a naturally lit premium setting with soft shadows and clean composition",
    white_bg: "shot on a pure white infinity background with studio lighting, no shadows on backdrop",
    model: "worn by a model in a lifestyle setting, natural ambient light, candid editorial style",
  };
  const sceneDesc = scenes[sceneMode] ?? scenes.scene;

  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  if (deepseekKey) {
    try {
      const OpenAI = (await import("openai")).default;
      const isProd = process.env.NODE_ENV === "production";
      const client = new OpenAI({
        apiKey: deepseekKey,
        baseURL: "https://api.deepseek.com",
        fetch: isProd ? undefined : createSocksFetch(),
      });

      // Ask DeepSeek to OUTPUT a visual description of the product.
      // We'll wrap it into a photography prompt ourselves.
      const langInstruction = lang === "zh"
        ? "用中文回答"
        : lang === "ja" ? "日本語で回答" : "Answer in English";

      const response = await client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are a luxury e-commerce copywriter writing product descriptions for AI photography. Given product info, write ONE sentence (under 100 words, ${langInstruction}) focused on unique materials, craftsmanship, tactile textures, and visual beauty. CRITICAL: vary your vocabulary every time — never reuse the same adjectives, lighting descriptions, or camera angles. Focus on different aspects each time (one time materials, next time lighting, next time texture). Output only the sentence.`,
          },
          {
            role: "user",
            content: `Product: ${name}.${points ? ` Key features: ${points}.` : ""}`,
          },
        ],
        temperature: 0.8,
        max_tokens: 250,
      });

      const description = response.choices[0]?.message?.content?.trim();
      if (description && description.length > 10) {
        // img2img prompt: product stays, background changes
        const enhancedPrompt =
          lang === "zh"
            ? `保留产品主体不变，将背景替换为：${sceneDesc}。${description}。8K高清，商业摄影`
            : `Keep the product exactly as shown in the reference image. Change the background to: ${sceneDesc}. ${description}. 8K, sharp focus, commercial quality.`;

        return NextResponse.json({ enhanced: enhancedPrompt });
      }
    } catch {
      // Fall through to template
    }
  }

  // Template fallback
  const fallback = lang === "zh"
    ? `专业商品摄影：${name}${points ? "，" + points : ""}。${sceneDesc}，8K高清，商业级画质`
    : `Professional product photography of ${name}${points ? ", " + points : ""}. ${sceneDesc}, 8K, sharp focus, commercial quality.`;

  return NextResponse.json({ enhanced: fallback });
}
