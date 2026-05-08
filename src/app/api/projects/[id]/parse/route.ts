import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { advanceProject, failProject } from "@/lib/pipeline-db";
import type { NextRequest } from "next/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await db.videoProject.findUnique({ where: { id } });

  if (!project || project.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (project.status !== "PARSING") {
    return Response.json({ error: "Project is not in PARSING state" }, { status: 400 });
  }

  try {
    let title = "";
    let image = "";

    try {
      const res = await fetch(project.productUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10000),
      });
      const html = await res.text();

      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) title = titleMatch[1].trim().replace(/\s+/g, " ").slice(0, 200);

      const imgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
        ?? html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);
      if (imgMatch) image = imgMatch[1];
    } catch {
      title = "商品链接";
      image = "";
    }

    await advanceProject(id, "SCRIPTING");

    const updated = await db.videoProject.update({
      where: { id },
      data: { productTitle: title || "未命名商品", productImage: image },
    });

    return Response.json(updated);
  } catch (e) {
    await failProject(id, `解析失败: ${e instanceof Error ? e.message : "未知错误"}`);
    return Response.json({ error: "Parse failed" }, { status: 500 });
  }
}
