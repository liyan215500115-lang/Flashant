import "server-only";

import { cookies } from "next/headers";

type Locale = "zh" | "en";

const messages: Record<string, Record<Locale, string>> = {
  "common.untitled": {
    zh: "未命名",
    en: "Untitled",
  },
  "error.quotaExceeded": {
    zh: "额度已用完。请升级套餐继续使用。",
    en: "Quota exhausted. Please upgrade to continue.",
  },
  "error.brandNameRequired": {
    zh: "品牌名称不能为空",
    en: "Brand name is required",
  },
  "error.invalidImage": {
    zh: "请上传有效的图片文件",
    en: "Please upload a valid image file",
  },
  "error.fileSaveFailed": {
    zh: "文件保存失败",
    en: "File save failed",
  },
  "api.taskCreated": {
    zh: "任务已创建，请通过 /api/tasks/[id] 查询进度",
    en: "Task created. Check progress via /api/tasks/[id]",
  },
};

export async function getServerLocale(): Promise<Locale> {
  try {
    const cookieStore = await cookies();
    const val = cookieStore.get("NEXT_LOCALE")?.value;
    if (val === "zh") return "zh";
    return "en";
  } catch {
    // cookies() may throw during static generation
  }
  return "en";
}

export async function serverT(key: string, locale?: Locale): Promise<string> {
  const loc = locale ?? (await getServerLocale());
  return messages[key]?.[loc] ?? key;
}
