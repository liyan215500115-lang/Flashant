import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSocksFetch } from "@/lib/ai/socks-fetch";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { productName, sellingPoints, platform } = await req.json();
  if (!productName) return NextResponse.json({ error: "productName required" }, { status: 400 });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    // Fallback: template-based generation
    const fallback = generateFallback(productName, sellingPoints, platform);
    return NextResponse.json(fallback);
  }

  try {
    const OpenAI = (await import("openai")).default;
    const isProd = process.env.NODE_ENV === "production";
    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com",
      fetch: isProd ? undefined : createSocksFetch(),
    });

    const platformName = platform || "Shopify";
    const points = sellingPoints ? `Selling points: ${sellingPoints}` : "";

    const response = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are an expert e-commerce copywriter. Generate product listing content optimized for ${platformName}. Output valid JSON only.`,
        },
        {
          role: "user",
          content: `Generate an e-commerce listing for: "${productName}". ${points}

Return ONLY a JSON object with these keys:
- "title": A compelling product title (max 200 chars, include key features)
- "description": A persuasive product description paragraph (2-3 sentences)
- "bullets": An array of exactly 5 bullet points highlighting key features and benefits
- "keywords": An array of 5-8 search keywords/tags`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? "";
    // Extract JSON from response (may be wrapped in ```json)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return NextResponse.json(parsed);
    }
    return NextResponse.json(generateFallback(productName, sellingPoints, platform));
  } catch {
    return NextResponse.json(generateFallback(productName, sellingPoints, platform));
  }
}

function generateFallback(product: string, sellingPoints?: string, platform?: string) {
  const points = sellingPoints ? sellingPoints.split(/[,;，；]/).slice(0, 5) : [];
  return {
    title: `${product} — Professional Quality${platform ? ` for ${platform}` : ""}`,
    description: `${product} crafted with premium materials. Designed to elevate your brand with superior quality and attention to detail.`,
    bullets: points.length > 0 ? points.map((p) => p.trim()).filter(Boolean) : [
      "Premium quality materials",
      "Professional craftsmanship",
      "Satisfaction guaranteed",
      "Fast shipping worldwide",
      "30-day money-back guarantee",
    ],
    keywords: [product, ...product.split(" ").slice(0, 3)],
  };
}
