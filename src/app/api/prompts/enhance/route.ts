import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSocksFetch } from "@/lib/ai/socks-fetch";

const STYLE_GUIDANCE: Record<string, { desc: string; guidance: string }> = {
  white: { desc: "pure white infinity background #FFFFFF, softbox lighting, clean e-commerce packshot", guidance: "Focus on shape, colors, materials, surface finish. Be factual — name materials, finish type, color palette. Do not describe background." },
  scene: { desc: "curated aspirational interior, natural window light, 50mm f/2.8, editorial lifestyle (Kinfolk/Cereal)", guidance: "Place the product naturally in a beautiful room. Focus on lifestyle fit. Describe the room, mood, lighting, emotional appeal. Make it attainable yet desirable." },
  in_use: { desc: "product being worn/used by a person, candid moment, soft daylight 5500K, 50mm f/2.0, editorial lifestyle", guidance: "Describe natural human interaction with the product. Focus on user experience. Describe body language, setting, lighting. The product is the hero, not the model." },
  marble: { desc: "marble or walnut surface, directional key light, 45% negative space, Aesop/Le Labo aesthetic", guidance: "Luxury editorial. Focus on refinement. Glossy reflections, premium materials, rich palette. Words: bespoke, artisanal, sculptural." },
  natural: { desc: "golden hour outdoor 3200K, f/1.8, soft bokeh, 16:9 cinematic, wellness-lifestyle", guidance: "Golden-hour outdoor moment. Harmony between product and nature. Sunlight wrapping surfaces. Words: earthy, sun-kissed, wild, breathe." },
  cosy: { desc: "warm hygge interior, linen curtain light 4500K, Scandinavian-Japandi, 50mm f/2.2, Architectural Digest quality", guidance: "Warm soulful home moment. Comfort, belonging, quiet beauty. Textures, gentle lighting, slow morning. Words: hygge, serene, tactile, grounded." },
  dark_moody: { desc: "deep charcoal void, single fresnel spotlight, chiaroscuro, Byredo/Diptyque aesthetic", guidance: "Dramatic cinematic. Interplay of shadow and light. Product emerges from darkness. Words: noir, dramatic, sculptural, enigmatic, timeless." },
  cyberpunk: { desc: "wet asphalt, cyan#00FFFF + magenta#FF00FF neon, volumetric fog, Blade Runner 2049 aesthetic", guidance: "Futuristic cyberpunk. Neon reflections, atmospheric fog, contrast between product and neon environment. Words: neon-drenched, dystopian, high-tech, synthetic." },
  canvas: { desc: "watercolor paper surface, abstract watercolor wash background, product razor-sharp f/11, north window light 5000K", guidance: "Artist's studio. Product is real and sharp — only the background is painterly. Contrast between sharp product and watercolor backdrop. Words: textured, artisanal, gallery, fine art." },
  kawaii: { desc: "candy pastel gradient, floating gold stars/sparkles/hearts, matte white platform, product sharp f/11", guidance: "Cute pastel showcase. Product is real and unchanged — only the background is cute. Joyful, gift-worthy setting. Words: cute, pastel, playful, whimsical, kawaii." },
  infographic: { desc: "60-40 split, product on white left, info panel right, minimalist icons, Amazon A+ style, 8K", guidance: "Clean infographic presentation. Product plus elegant info panel. Clarity, trust, premium feel. Words: informative, clean, modern, trustworthy." },
};

// Photography direction for each detail image type.
// This tells the prompt AI what kind of image to generate — the PURPOSE of the image.
const DETAIL_TYPE_DIRECTION: Record<string, string> = {
  lifestyle: "The product shown naturally in a beautiful real-world interior or outdoor environment. Describe the setting, the mood, and how the product integrates into the scene. The product is the visual focus.",
  scene_atmosphere: "Dramatic atmospheric product photography. The product as a lone hero in a cinematic setting. Strong directional lighting, rich shadows. Describe the mood, lighting drama, and emotional impact.",
  in_use: "The product being actively used or worn by a person. Candid natural moment. Focus on the interaction — how the product is held, worn, or applied. The person is softly in frame, product is the hero.",
  detail: "Extreme close-up macro shot focusing on product texture, materials, and fine details. 100mm macro lens perspective. Reveal quality and craftsmanship. Do NOT render text or labels.",
  multi_angle: "Multiple views of the product composited: front, 45° side, rear, and top-down. White background, consistent scale and lighting. Professional catalog layout. Do NOT render text.",
  flatlay: "Overhead flat lay from directly above. Product surrounded by complementary accessories on a clean surface. Even soft lighting, editorial catalog style.",
  color_variants: "Product color variants in a clean grid on white background. Consistent angle and lighting. Professional catalog presentation.",
  selling_points: "Product centered on pure white background. Clean minimal e-commerce packshot with generous empty space. Text will be overlaid separately — generate a clean visual canvas. Do NOT render text.",
  material: "Extreme macro close-up of product materials and textures. Focus on surface quality, weave, grain, or finish. Clean visual canvas for text overlay. Do NOT render text.",
  size: "Product on white background with a common reference object for scale. Professional size reference photography. Clean canvas for text overlay. Do NOT render text.",
  craft: "Product on clean surface showing fine workmanship details. Soft directional light raking to reveal texture. Clean canvas for text overlay. Do NOT render text.",
  compare: "Split-screen comparison on white background. Two views side by side, identical lighting and scale. Clean canvas for text overlay. Do NOT render text.",
  brand_story: "Premium unboxing scene. Packaging, tissue paper, product, and accessories arranged beautifully. Warm window light, overhead angle, editorial quality.",
  gift_accessory: "Main product with all included accessories neatly arranged on a clean surface. Soft even studio lighting, all items equally sharp. Professional visual inventory.",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { imageUrl, productName, sellingPoints, styleName, detailType, targetLanguage } = await req.json();
  const name = productName || "product";
  const points = sellingPoints || "";
  const style = styleName || "scene";
  const lang = targetLanguage || "en";

  const styleInfo = STYLE_GUIDANCE[style] ?? STYLE_GUIDANCE.scene;
  const typeDirection = detailType ? DETAIL_TYPE_DIRECTION[detailType] : null;

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
        ? "用中文写出一个完整的、视觉化的产品摄影提示词。"
        : "Write one complete, visually descriptive product photography prompt in English.";

      // Build the task instruction
      const parts: string[] = [
        `Product name: ${name}`,
        points ? `User's notes: ${points}` : "",
        `Visual style: ${style} — ${styleInfo.desc}`,
        typeDirection ? `Image type: ${detailType} — ${typeDirection}` : "",
        "",
        "Write a professional AI image generation prompt following this structure:",
        "1. SUBJECT — describe the product based on the reference image",
        "2. ENVIRONMENT — describe the scene for this image type",
        "3. LIGHTING — direction, quality, color temperature Kelvin",
        "4. CAMERA — lens, aperture, depth of field, composition",
        "5. TECHNICAL — resolution, quality, output format",
      ];

      if (typeDirection) {
        parts.push(
          "",
          `IMAGE TYPE DIRECTION: ${typeDirection}`,
          "This is the photography purpose. The environment, lighting, and camera should serve this purpose.",
        );
      }

      parts.push(
        "",
        "CRITICAL RULES:",
        "- NEVER describe the product from imagination — use ONLY what you see in the reference image.",
        "- The product must remain visually IDENTICAL to the reference — same shape, color, materials.",
        "- You may ONLY change: background, scene, lighting, camera angle, composition.",
        "- Use precise photography terminology (f-stop, lens mm, Kelvin, lighting angles).",
        "- Include quality directives (8K, photorealistic, sharp focus).",
        "- Output ONLY the prompt. No introduction, no explanation, no quotes.",
        "- 80-150 words.",
      );

      const userText = parts.filter(Boolean).join("\n");

      type ContentPart =
        | { type: "image_url"; image_url: { url: string } }
        | { type: "text"; text: string };

      const userContent: ContentPart[] = [];
      if (imageUrl) {
        userContent.push({ type: "image_url", image_url: { url: imageUrl } });
      }
      userContent.push({ type: "text", text: userText });

      const response = await client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are an expert e-commerce product photography director. Analyze product reference images and write precise image generation prompts.

${styleInfo.guidance}

${typeDirection ? `IMAGE TYPE CONTEXT: ${typeDirection}` : ""}

Output: A single complete prompt in ${langInstruction}. Output ONLY the prompt — no preamble, no markdown, no quotes.`,
          },
          { role: "user", content: userContent },
        ],
        temperature: 0.8,
        max_tokens: 500,
      });

      const genPrompt = response.choices[0]?.message?.content?.trim();
      if (genPrompt && genPrompt.length > 20) {
        return NextResponse.json({ enhanced: genPrompt });
      }
    } catch {
      // Fall through to template fallback
    }
  }

  // Template fallback
  const typeDesc = typeDirection ? ` ${typeDirection}` : "";
  const fallback = lang === "zh"
    ? `${name}${points ? "，" + points : ""}。${styleInfo.desc}。${typeDesc}，8K，照片级真实，专业产品摄影。`
    : `${name}${points ? ", " + points : ""}. ${styleInfo.desc}.${typeDesc}, 8K, photorealistic, professional product photography.`;

  return NextResponse.json({ enhanced: fallback });
}
