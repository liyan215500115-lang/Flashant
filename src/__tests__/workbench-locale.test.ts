import { readFileSync } from "node:fs";
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
  ["detail.aiEdit", "AI Edit", "AI 编辑"],
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

  it("keeps the project page and sidebar on the message catalogs", () => {
    const page = readFileSync(path.join(ROOT, "src/app/(dashboard)/projects/[id]/page.tsx"), "utf8");
    const sidebar = readFileSync(path.join(ROOT, "src/app/(dashboard)/Sidebar.tsx"), "utf8");
    expect(page).toContain('t("sidebar.products")');
    expect(page).toContain('t("detail.delete")');
    expect(page).toContain('t("detail.download")');
    expect(page).toContain('t("detail.publishShopify")');
    expect(page).toContain('t("detail.aiEdit")');
    expect(page).toContain('t("detail.selectImages")');
    expect(page).toContain('t("detail.quotaRemaining")');
    expect(page).toContain('t("detail.quotaRetry")');
    expect(page).not.toContain('t("detail.quotaUnavailable")');
    expect(page).not.toContain("Couldn't load remaining quota");
    expect(page).not.toContain("剩余额度加载失败");
    expect(page).toContain("<AiEditLink");
    expect(page).not.toContain('<Link href={`/studio?projectId=${project.id}`}>');
    expect(page).toContain("generationStatusText");
    expect(page).not.toContain("All generations complete");
    expect(page).not.toContain(">我的项目<");
    expect(page).not.toContain("发布到 Shopify");
    expect(page).not.toContain("选择图片");
    expect(sidebar).toContain('t("sidebar.dashboard")');
    expect(sidebar).toContain('t("sidebar.studio")');
    expect(sidebar).toContain('t("sidebar.products")');
    expect(sidebar).toContain('t("sidebar.assetsCenter")');
    expect(sidebar).toContain('t("sidebar.settings")');
    expect(sidebar).not.toContain(">Dashboard<");
    expect(sidebar).not.toContain(">New Project<");
    expect(sidebar).not.toContain(">Asset Center<");
  });
});
