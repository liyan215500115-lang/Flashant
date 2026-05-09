import type { ScriptProvider, ScriptGenerationResult, ProductAnalysis } from "./types";

export function createClaudeAdapter(apiKey?: string): ScriptProvider {
  const key = apiKey;

  async function callClaude(prompt: string, imageUrl?: string): Promise<string> {
    if (!key) {
      throw new Error("CLAUDE_API_KEY not configured");
    }

    const content: unknown[] = [{ type: "text", text: prompt }];
    if (imageUrl) {
      content.unshift({
        type: "image",
        source: {
          type: "url",
          url: imageUrl,
        },
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Claude API error: ${response.status} ${await response.text()}`
      );
    }

    const data = await response.json();
    return data.content[0].text;
  }

  function extractJson<T>(text: string): T {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Claude response did not contain valid JSON");
    }
    return JSON.parse(jsonMatch[0]) as T;
  }

  return {
    name: "claude",

    async analyzeImage(imageUrl: string, hint?: string): Promise<ProductAnalysis> {
      const prompt = `你是一个电商商品分析专家。请观察这张商品图片，分析商品信息。

${hint ? `用户提示: ${hint}` : ""}

请严格按照以下JSON格式输出，不要包含任何其他文字：

{
  "name": "商品名称（简洁准确）",
  "category": "商品品类",
  "features": ["卖点1", "卖点2", "卖点3"],
  "sellingPoints": ["营销卖点1", "营销卖点2"],
  "usageScenario": "使用场景描述",
  "targetAudience": "目标人群描述",
  "fullDescription": "完整的商品描述（用于生成脚本，150字以内）"
}`;

      const text = await callClaude(prompt, imageUrl);
      return extractJson<ProductAnalysis>(text);
    },

    async generate(
      productTitle: string,
      productDescription: string,
      productImageUrl?: string
    ): Promise<ScriptGenerationResult> {
      const prompt = buildScriptPrompt(
        productTitle,
        productDescription,
        productImageUrl
      );

      const text = await callClaude(prompt);
      return extractJson<ScriptGenerationResult>(text);
    },
  };
}

function buildScriptPrompt(
  title: string,
  description: string,
  imageUrl?: string
): string {
  return `你是一个电商短视频脚本专家。根据以下商品信息，生成一个短视频脚本，包含3-5个场景。

商品名称: ${title}
商品描述: ${description}
${imageUrl ? `商品图片: ${imageUrl}` : ""}

请严格按照以下JSON格式输出，不要包含任何其他文字：

{
  "scenes": [
    {
      "index": 0,
      "description": "场景画面描述（中文）",
      "voiceoverText": "此场景的旁白文案（中文，口语化，有感染力）",
      "imagePrompt": "AI文生图提示词（英文，详细描述画面构图、光线、色彩、风格，适合电商产品摄影）",
      "videoPrompt": "AI图生视频提示词（英文，描述画面动态，如镜头运动、光线变化、产品展示角度）",
      "durationSeconds": 5
    }
  ],
  "voiceover": "完整旁白文案汇总",
  "hashtags": ["#标签1", "#标签2", "#标签3"]
}

要求：
- 前3-5秒为"黄金钩子"，抓住注意力
- 中间场景展示产品使用场景和卖点
- 最后3-5秒亮价格或促销信息促转化
- 每个场景5秒左右，总计15-25秒
- 旁白口语化，有情绪感染力，符合抖音/快手短视频风格`;
}
