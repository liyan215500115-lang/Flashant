import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import zh from "../../messages/zh.json";
import { translate } from "@/lib/translate";

const ROOT = path.resolve(__dirname, "../..");

const WORKBENCH_COPY: Array<[string, string, string]> = [
  ["sidebar.dashboard", "Dashboard", "控制台"],
  ["sidebar.studio", "New Project", "新建项目"],
  ["sidebar.products", "My Projects", "我的项目"],
  ["sidebar.assetsCenter", "Asset Center", "素材中心"],
  ["sidebar.settings", "Settings", "系统设置"],
  ["status.GENERATED", "Generated", "已生成"],
  ["detail.delete", "Delete", "删除"],
  ["detail.allDone", "All generations complete", "全部生成完成"],
  ["detail.imagesReady", "product images ready", "张商品图已就绪"],
  ["detail.imagesUnavailable", "Generation finished, but {count} image files are no longer available", "生成已完成，但 {count} 张图片文件已失效，无法显示"],
  ["detail.download", "Download", "下载"],
  ["detail.publishShopify", "Publish to Shopify", "发布到 Shopify"],
  ["detail.aiEdit", "Open studio", "打开工作室"],
  ["detail.notGenerated", "Not generated", "未生成"],
  ["detail.noShotsTitle", "No shots yet", "还没有成片"],
  ["detail.continueInStudio", "Continue in studio", "在工作室继续生成"],
  ["detail.selectImages", "Select images", "选择图片"],
  ["detail.quotaRemaining", "Remaining this month", "本月剩余"],
  ["detail.quotaRetry", "Reload", "重新读取"],
  ["detail.imageUnavailable", "Unavailable", "图片已失效"],
];

describe("workbench locale strings", () => {
  it.each(WORKBENCH_COPY)("%s is translated in English and Chinese", (key, english, chinese) => {
    expect(translate(en, key)).toBe(english);
    expect(translate(zh, key)).toBe(chinese);
    expect(translate(en, key)).not.toBe(translate(zh, key));
  });

  it("keeps the empty-state title free of the scene word that belongs in the sentence", () => {
    expect(translate(zh, "detail.noShotsTitle")).toBe("还没有成片");
    expect(translate(zh, "detail.noShotsTitle")).not.toContain("场景");
    expect(translate(zh, "detail.noShotsSource")).toContain("场景");
    expect(translate(zh, "detail.noShotsEmpty")).toContain("场景");
  });

  it("keeps the project page and sidebar on the message catalogs", () => {
    const page = readFileSync(path.join(ROOT, "src/app/(dashboard)/projects/[id]/page.tsx"), "utf8");
    const view = readFileSync(path.join(ROOT, "src/components/project/project-detail-view.tsx"), "utf8");
    const publish = readFileSync(path.join(ROOT, "src/app/(dashboard)/projects/[id]/publish/page.tsx"), "utf8");
    const surface = `${page}\n${view}`;
    const sidebar = readFileSync(path.join(ROOT, "src/app/(dashboard)/Sidebar.tsx"), "utf8");
    expect(surface).toContain('t("sidebar.products")');
    expect(surface).toContain('t("detail.delete")');
    expect(surface).toContain('t("detail.download")');
    expect(surface).toContain('t("detail.publishShopify")');
    expect(surface).toContain('t("detail.aiEdit")');
    expect(surface).toContain('t("detail.selectImages")');
    expect(surface).toContain('t("detail.quotaRemaining")');
    expect(surface).toContain('t("detail.quotaRetry")');
    expect(surface).not.toContain('t("detail.quotaUnavailable")');
    expect(surface).not.toContain("Couldn't load remaining quota");
    expect(surface).not.toContain("剩余额度加载失败");
    expect(view).toContain("<AiEditLink");
    expect(surface).not.toContain('<Link href={`/studio?projectId=${project.id}`}>');
    expect(view).toContain("href={`/projects/${projectId}/publish`}");
    expect(surface).not.toMatch(/<Link[^>]*>\s*<Button/);
    expect(publish).not.toMatch(/<Link[^>]*>\s*<Button/);
    expect(publish).toContain('href="/integrations"');
    expect(page).toContain("generationStatusText");
    expect(page).not.toContain("All generations complete");
    expect(surface).not.toContain(">我的项目<");
    expect(surface).not.toContain("发布到 Shopify");
    expect(surface).not.toContain("选择图片");
    expect(sidebar).toContain('t("sidebar.dashboard")');
    expect(sidebar).toContain('t("sidebar.studio")');
    expect(sidebar).toContain('t("sidebar.products")');
    expect(sidebar).toContain('t("sidebar.assetsCenter")');
    expect(sidebar).toContain('t("sidebar.settings")');
    expect(sidebar).not.toContain(">Dashboard<");
    expect(sidebar).not.toContain(">New Project<");
    expect(sidebar).not.toContain(">Asset Center<");
  });

  it("has the redesigned detail strings in every catalog", () => {
    const keys = ["aiEdit", "notGenerated", "shots", "shotCount", "noShotsTitle", "noShotsSource", "noShotsEmpty", "continueInStudio", "originalBadge", "editLocalHint"];
    const files = readdirSync(path.join(ROOT, "messages")).filter((name) => name.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const name of files) {
      const detail = JSON.parse(readFileSync(path.join(ROOT, "messages", name), "utf8")).detail;
      for (const key of keys) expect(detail[key], `${name} ${key}`).toBeTruthy();
    }
  });
});
