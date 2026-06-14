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

  // Scene-aware descriptions — each scene has a distinct visual goal
  const scenes: Record<string, string> = {
    white: "shot on a pure white infinity background with soft studio lighting, no shadows on backdrop, e-commerce packshot style",
    scene: "placed in a naturally lit premium setting with soft shadows and clean composition, professional product photography",
    model: "worn by a model in a lifestyle setting, natural ambient light, candid editorial style, fashion photography",
    natural: "shot outdoors in golden hour sunlight with natural green bokeh background, warm tones, lifestyle photography",
    marble: "placed on an elegant white marble surface with soft window light, shallow depth of field, luxury aesthetic",
    nordic: "set in a bright Scandinavian interior with minimal decor, natural wood textures, soft diffused daylight",
    lifestyle: "captured in a real home or cafe environment, candid photography, relatable authentic, soft natural lighting",
  };
  const sceneDesc = scenes[sceneMode] ?? scenes.scene;

  // Scene-specific system prompts for the AI copywriter
  const sceneGuidance: Record<string, string> = {
    white: "Focus on the product's shape, color accuracy, materials, and fine details. Describe how the pure background makes every edge and surface visible. This is a factual product description.",
    scene: "Focus on how the product fits into a lifestyle — its emotional appeal, how it looks in a real room, the aspirational mood it creates. Describe the setting and atmosphere.",
    model: "Focus on how the product looks on the person — fit, drape, proportion, movement. Describe the model's expression, pose, and the connection between the product and the wearer.",
    natural: "Focus on the product's relationship with nature — how light plays on its surface, the organic textures, the outdoor harmony. Evoke a sense of freedom and freshness.",
    marble: "Focus on luxury — the premium materials, the glossy reflections, the high-end feel. Describe the color palette and the upscale, exclusive atmosphere.",
    nordic: "Focus on minimalism and purity — clean lines, functional beauty, the calm and organized aesthetic. Describe how the setting enhances the product's simplicity.",
    lifestyle: "Focus on authenticity — how a real person would use this product in their daily life. Describe the genuine, unstaged moment and the comfort it brings.",
  };
  const guidance = sceneGuidance[sceneMode] ?? sceneGuidance.scene;

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

      const langInstruction = lang === "zh"
        ? "用中文回答，输出一个完整句子"
        : lang === "ja" ? "日本語で回答" : "Answer in English, output one complete sentence";

      const response = await client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are an expert e-commerce product photography director. Your job is to write ONE visually descriptive sentence that will be used as an AI image generation prompt.

${guidance}

Rules:
- Write in ${langInstruction}
- Be specific and visual — name materials, textures, colors, lighting quality
- Vary your vocabulary — never reuse the same adjectives across invocations
- Output ONLY the sentence, no preamble, no quotes
- Under 80 words`,
          },
          {
            role: "user",
            content: `Product: ${name}.${points ? ` Key selling points: ${points}.` : ""}`,
          },
        ],
        temperature: 0.9,
        max_tokens: 300,
      });

      const description = response.choices[0]?.message?.content?.trim();
      if (description && description.length > 10) {
        const enhancedPrompt = `${description}. ${sceneDesc}, 8K, sharp focus.`;
        return NextResponse.json({ enhanced: enhancedPrompt });
      }
    } catch {
      // Fall through to template
    }
  }

  // Template fallback
  const fallback = `${name}${points ? ", " + points : ""}. ${sceneDesc}, 8K, professional product photography.`;
  return NextResponse.json({ enhanced: fallback });
}
