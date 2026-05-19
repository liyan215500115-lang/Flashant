import "server-only";

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createSocksFetch } from "@/lib/ai/socks-fetch";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { prompt } = await req.json();
  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
      { status: 500 }
    );
  }

  let enhanced = prompt;
  try {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey, fetch: createSocksFetch() });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional product photography prompt engineer. Translate the user's Chinese prompt into a detailed, vivid English prompt suitable for AI image generation. Focus on lighting, composition, materials, colors, and atmosphere. Output ONLY the English prompt, no explanation.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    enhanced = response.choices[0]?.message?.content?.trim() ?? prompt;
  } catch {
    // If OpenAI fails, return the original prompt
  }

  return NextResponse.json({ enhanced });
}
