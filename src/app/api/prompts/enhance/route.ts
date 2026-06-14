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
    white: "shot on a pure white infinity background with soft studio lighting, subtle natural shadow beneath, e-commerce packshot style",
    scene: "styled in a clean, aspirational setting appropriate to the product's use, professional interior photography",
    in_use: "being actively used by a person, natural interaction, candid moment, authentic lifestyle photography",
    marble: "placed on an elegant surface with soft directional light, premium luxury aesthetic, high-end commercial photography",
    natural: "shot outdoors in golden hour sunlight with natural green bokeh background, warm tones, lifestyle photography",
    cosy: "set in a warm inviting home interior with soft warm lighting, textiles and natural materials, Scandinavian style",
    dark_moody: "dramatically lit against a dark background, single key light creating striking shadows, cinematic product photography",
  };
  const sceneDesc = scenes[sceneMode] ?? scenes.scene;

  const sceneGuidance: Record<string, string> = {
    white: "Focus on the product's shape, color accuracy, materials, and fine details. The pure background makes every edge visible. Factual, precise product description.",
    scene: "Focus on how the product fits into an aspirational lifestyle. Describe the room, the mood, the emotional appeal. Make the setting feel attainable yet desirable.",
    in_use: "Focus on the user experience — how the product feels to wear, hold, or operate. Describe the natural interaction, the fit, the ease of use. Make the reader imagine themselves using it.",
    marble: "Focus on luxury and exclusivity. Describe the glossy reflections, the premium materials, the rich color palette. Every word should evoke quality and refinement.",
    natural: "Focus on the harmony between the product and nature. Describe how sunlight interacts with surfaces, the organic textures, the sense of freedom and freshness.",
    cosy: "Focus on comfort and belonging. Describe the warmth, the soft textures, the feeling of being at home. Make the product feel like a natural part of daily life.",
    dark_moody: "Focus on drama and intensity. Describe the interplay of shadow and light, the cinematic atmosphere, the sense of mystery and sophistication.",
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
