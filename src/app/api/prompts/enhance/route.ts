import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSocksFetch } from "@/lib/ai/socks-fetch";

// Style definitions — each key maps to a distinct visual goal and guidance
const STYLE_GUIDANCE: Record<string, { desc: string; guidance: string }> = {
  white: {
    desc: "pure white infinity background #FFFFFF, softbox lighting from two 45-degree angles, subtle ground contact shadow only, clean e-commerce packshot style, 2048x2048px square, product filling 85% of frame",
    guidance: "Write a precise product description. Focus on shape, colors, materials, surface finish, and fine details. The pure background makes every edge visible. Be factual and specific — name the materials, the finish type (matte/gloss/textured), the color palette. Do not describe any background or environment.",
  },
  scene: {
    desc: "curated aspirational real-world interior setting, abundant natural window light from left, warm neutral undertones, shallow depth of field f/2.8, 50mm lens, editorial home/lifestyle magazine quality (Kinfolk, Cereal aesthetic)",
    guidance: "Describe an aspirational lifestyle scene. Place the product naturally in a beautiful room. Focus on how the product fits into daily life — describe the room, the mood, the lighting, the emotional appeal. Make the setting feel attainable yet desirable. Name specific interior styles (Scandinavian, Japandi, mid-century modern) and materials (linen, oak, marble, ceramic).",
  },
  in_use: {
    desc: "product being actively used or worn by a real person, candid mid-action moment, soft diffused daylight 5500K, 50mm lens f/2.0, focus on the product and interaction area, model's face softly out of focus, editorial lifestyle quality (Everlane, Uniqlo lookbook style)",
    guidance: "Describe a natural human interaction with the product. Focus on the user experience — how the product feels to wear, hold, or operate. Describe the person's body language, the setting, the lighting. Make it feel like a captured moment, not a photoshoot. The product is the hero, not the model.",
  },
  marble: {
    desc: "Carrara marble or dark walnut wood surface, single directional soft key light at 30 degrees, 45% negative space, desaturated warm neutral palette (sage, stone, cream, charcoal), subtle brass or gold accent in deep blurred background, 85mm tilt-shift effect, Aesop / Le Labo / Tom Ford Beauty aesthetic",
    guidance: "Write a luxury editorial description. Focus on exclusivity and refinement. Describe the glossy reflections, the premium materials, the rich sophisticated color palette. Use words that evoke quality: 'bespoke', 'artisanal', 'heirloom', 'sculptural'. The mood is quiet confidence, not loud luxury.",
  },
  natural: {
    desc: "golden hour outdoor setting 3200K, warm directional sunlight, f/1.8 shallow depth, soft bokeh circles from foliage, hazy atmosphere, 16:9 cinematic ratio, wellness-lifestyle aesthetic, Instagram/TikTok ready",
    guidance: "Describe a golden-hour outdoor moment. Focus on the harmony between the product and nature. Describe how sunlight wraps around surfaces, the organic textures, the sense of freedom and freshness. Use words like 'earthy', 'sun-kissed', 'wild', 'breathe'. Make it feel spontaneous, not staged.",
  },
  cosy: {
    desc: "warm hygge interior, soft diffused window light through linen curtain 4500K, Scandinavian-Japandi fusion, natural linen and chunky knit textures, warm oak wood, matte ceramics, dried botanicals, candlelight, 50mm f/2.2 shallow depth, Architectural Digest / Dezeen quality",
    guidance: "Describe a warm, soulful home moment. Focus on comfort, belonging, and quiet beauty. Describe the textures (soft linen, warm wood, rough ceramic), the gentle lighting, the feeling of a slow Sunday morning. The product feels like a natural part of this peaceful life. Words: 'hygge', 'serene', 'tactile', 'grounded'.",
  },
  dark_moody: {
    desc: "deep charcoal void background, single fresnel spotlight from upper-right 45 degrees, dramatic chiaroscuro, subtle rim light at 5%, rich deep blacks RGB(15,15,15), controlled specular highlights, single wisp of smoke or dust in light beam, square 1:1, Byredo / Aesop / Diptyque aesthetic",
    guidance: "Write a dramatic, cinematic description. Focus on the interplay of shadow and light. The product emerges from darkness like a sculpture. Describe the mystery, the intensity, the exclusivity. Use words like 'noir', 'dramatic', 'sculptural', 'enigmatic', 'timeless'. Each word should feel heavy with atmosphere.",
  },
  cyberpunk: {
    desc: "reflective wet asphalt or dark metallic surface, dual neon rim lights cyan #00FFFF left + magenta #FF00FF right, volumetric fog with visible light rays, holographic grid lines receding into darkness, distant blurred city lights warm amber and cool teal, water droplets reflecting neon, 21:9 ultrawide cinematic ratio, Blade Runner 2049 production design",
    guidance: "Describe a futuristic cyberpunk scene. The product looks like high-tech gear from a Blade Runner world. Focus on the neon reflections on surfaces, the atmospheric fog, the contrast between warm product materials and cool neon environment. Use words like 'neon-drenched', 'dystopian', 'high-tech', 'synthetic', 'holographic'. Make it cinematic and immersive.",
  },
  canvas: {
    desc: "watercolor illustration meets product photography hybrid, product sharp photorealistic at center with edges dissolving into visible watercolor brushwork, 300gsm cold-pressed paper texture or raw linen canvas, background blooms into loose pigment washes (dusty cerulean, warm ochre, sage, blush rose, raw umber), wet-on-wet diffusion blooms and dry brush texture visible, north-facing natural window light 5000K, 4:5 portrait, Pinterest editorial, Etsy artisan aesthetic",
    guidance: "Describe an artisanal still life that looks hand-painted. Focus on the painterly qualities — visible brushwork, pigment blooms, paper texture, the soft dissolution of edges. The product should feel like it belongs in a fine artist's watercolor study. Use words like 'painterly', 'pigment', 'brushwork', 'artisanal', 'handcrafted', 'gallery'. Avoid any digital/vector language.",
  },
  kawaii: {
    desc: "candy pastel gradient background (blush pink to lavender to baby blue), tiny floating matte gold stars, sparkle bursts, soft pillowy clouds, miniature ♡ hearts as subtle decorative elements, matte white or light pastel platform surface with soft rounded edges, product in sharp focus f/11, background decorations softly blurred f/2.8 for depth separation, sweet playful atmosphere, square 1:1, 4K, clean commercial product photography with cute backdrop — the product itself is 100% real and unchanged",
    guidance: "Describe a cute pastel product showcase. THE PRODUCT STAYS EXACTLY THE SAME as the reference — do NOT transform it into a toy, figurine, or cartoon character. Only change the background to a candy-colored pastel gradient with tiny sparkles, stars, hearts, and soft clouds. The product should look like it's photographed on a cute desktop wallpaper. It's a real product in a joyful, gift-worthy setting. Use words like 'cute', 'pastel', 'playful', 'whimsical', 'sweet', 'kawaii atmosphere'. Target emotion: joy and delight — but the product is real, not a toy.",
  },
  infographic: {
    desc: "60-40 split layout, product on white left, clean information panel right with minimalist line icons and short feature callouts, sans-serif typography (Inter/SF Pro style, 14px), subtle dot grid or diagonal line pattern at 5% opacity behind text only, charcoal #333333 text, brand accent color for icons, Amazon A+ Content / Shopify PDP standard, 8K sharp text rendering",
    guidance: "Describe a clean infographic product presentation. The product is on one side, and an elegant information panel is on the other. Focus on clarity, trustworthiness, and premium feel. The design should look like a high-end app onboarding screen. Use words like 'informative', 'clean', 'modern', 'trustworthy', 'premium UI'. No clutter, everything has breathing room.",
  },
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { imageUrl, productName, sellingPoints, styleName, targetLanguage } = await req.json();
  const name = productName || "product";
  const points = sellingPoints || "";
  const style = styleName || "scene";
  const lang = targetLanguage || "en";

  const styleInfo = STYLE_GUIDANCE[style] ?? STYLE_GUIDANCE.scene;

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

      // Build user message — vision analysis if imageUrl is provided
      const userText = [
        `Product name: ${name}`,
        points ? `User's selling points or notes: ${points}` : "",
        `Target style: ${style} — ${styleInfo.desc}`,
        "",
        "Your task: Write a professional AI image generation prompt following the 5-layer structure:",
        "1. SUBJECT — describe the product (materials, colors, shape, finish) based on the reference image",
        "2. ENVIRONMENT — describe the scene/background/setting for this style",
        "3. LIGHTING — specify light direction, quality, color temperature in Kelvin",
        "4. CAMERA — specify lens, aperture, depth of field, composition",
        "5. TECHNICAL — resolution, aspect ratio, quality level, output format",
        "",
        "CRITICAL RULES:",
        "- NEVER describe the product from imagination. Use ONLY what you see in the reference image.",
        "- Describe the WORLD AROUND the product, not the product itself in detail.",
        "- The product must remain visually IDENTICAL to the reference — same shape, color, materials, details.",
        "- You may ONLY change: background, scene, lighting, camera angle, composition.",
        "- Use precise photography terminology (f-stop, lens mm, color temperature Kelvin, lighting angles).",
        "- Include explicit quality directives (8K, photorealistic, maximum quality, sharp focus).",
        "- Output ONLY the prompt. No introduction, no explanation, no quotation marks.",
        "- Keep the prompt between 80-150 words — detailed but concise.",
      ].filter(Boolean).join("\n");

      type ContentPart =
        | { type: "image_url"; image_url: { url: string } }
        | { type: "text"; text: string };

      const userContent: ContentPart[] = [];

      if (imageUrl) {
        userContent.push({
          type: "image_url" as const,
          image_url: { url: imageUrl },
        });
      }

      userContent.push({
        type: "text" as const,
        text: userText,
      });


      const response = await client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are an expert e-commerce product photography director and AI prompt engineer. Your job is to analyze product reference images and write precise, structured image generation prompts that a text-to-image AI model will use.

${styleInfo.guidance}

Output format: A single complete prompt in ${langInstruction}. The prompt follows a 5-layer structure: subject description, environment/scene, lighting/camera specs, composition, technical parameters. Output ONLY the prompt — no preamble, no markdown, no quotes.`,
          },
          {
            role: "user",
            content: userContent,
          },
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

  // Template fallback — no API key or API call failed
  const fallback = lang === "zh"
    ? `${name}${points ? "，" + points : ""}。${styleInfo.desc}，8K，照片级真实，专业产品摄影。`
    : `${name}${points ? ", " + points : ""}. ${styleInfo.desc}, 8K, photorealistic, professional product photography.`;

  return NextResponse.json({ enhanced: fallback });
}
