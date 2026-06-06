export interface PlatformImageSpec {
  platform: string;
  name: string;
  /** Whether one-click publish is supported */
  publishable: boolean;
  /** Recommended image dimensions (e.g. "2048 × 2048 px") */
  dimensions: string;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Aspect ratio */
  ratio: string;
  /** Accepted file formats */
  formats: string[];
  /** Max file size */
  maxFileSize: string;
  /** Max number of images allowed */
  maxImages: number;
  /** Background requirements */
  background: string;
  /** Prompt suffix added during generation */
  promptSuffix: string;
  /** Additional notes */
  notes: string[];
  /** Supported languages for this platform */
  languages: { code: string; label: string; labelZh: string }[];
}

export const PLATFORM_SPECS: Record<string, PlatformImageSpec> = {
  // ── Publishable (one-click) ──
  SHOPIFY: {
    platform: "SHOPIFY",
    name: "Shopify",
    publishable: true,
    dimensions: "2048 × 2048 px",
    width: 2048,
    height: 2048,
    ratio: "1:1",
    formats: ["JPEG", "PNG", "WebP"],
    maxFileSize: "20 MB",
    maxImages: 10,
    background: "纯色背景，推荐白底或浅灰底",
    promptSuffix:
      "clean professional product photography, studio lighting, simple background",
    notes: [
      "建议压缩至 300 KB 以下以提升加载速度",
      "所有图片统一 1:1 比例以保持页面整齐",
    ],
    languages: [
      { code: "en", label: "English", labelZh: "英语" },
      { code: "zh", label: "中文", labelZh: "中文" },
      { code: "ja", label: "日本語", labelZh: "日语" },
      { code: "de", label: "Deutsch", labelZh: "德语" },
      { code: "fr", label: "Français", labelZh: "法语" },
      { code: "es", label: "Español", labelZh: "西班牙语" },
    ],
  },
  TIKTOK_SHOP: {
    platform: "TIKTOK_SHOP",
    name: "TikTok Shop",
    publishable: true,
    dimensions: "1080 × 1080 px",
    width: 1080,
    height: 1080,
    ratio: "1:1",
    formats: ["JPEG", "PNG"],
    maxFileSize: "5 MB",
    maxImages: 9,
    background: "主图纯白背景 (RGB 255, 255, 255)",
    promptSuffix:
      "pure white background, product centered, bright even lighting, full product visible, no text no watermark",
    notes: [
      "商品需占图片空间 60% 以上",
      "禁止水印、文字、Logo、边框、拼贴",
      "建议上传 5-9 张多角度图片",
      "不得使用明显 AI 生成痕迹的图片",
    ],
    languages: [
      { code: "en", label: "English", labelZh: "英语" },
      { code: "zh", label: "中文", labelZh: "中文" },
      { code: "ja", label: "日本語", labelZh: "日语" },
    ],
  },

  // ── Download-only ──
  AMAZON: {
    platform: "AMAZON",
    name: "Amazon",
    publishable: false,
    dimensions: "2000 × 2000 px",
    width: 2000,
    height: 2000,
    ratio: "1:1",
    formats: ["JPEG", "PNG", "TIFF"],
    maxFileSize: "10 MB",
    maxImages: 9,
    background: "必须纯白背景 (RGB 255, 255, 255)",
    promptSuffix:
      "pure white background, product only, professional e-commerce photography, no shadows, no props, product fills 85% of frame",
    notes: [
      "主图必须纯白底，商品占画面 85% 以上",
      "禁止水印、文字、Logo、促销信息",
      "辅图可为场景图或细节图",
    ],
    languages: [
      { code: "en", label: "English", labelZh: "英语" },
      { code: "ja", label: "日本語", labelZh: "日语" },
      { code: "de", label: "Deutsch", labelZh: "德语" },
      { code: "fr", label: "Français", labelZh: "法语" },
      { code: "es", label: "Español", labelZh: "西班牙语" },
      { code: "it", label: "Italiano", labelZh: "意大利语" },
    ],
  },
  EBAY: {
    platform: "EBAY",
    name: "eBay",
    publishable: false,
    dimensions: "1600 × 1600 px",
    width: 1600,
    height: 1600,
    ratio: "1:1",
    formats: ["JPEG", "PNG"],
    maxFileSize: "12 MB",
    maxImages: 12,
    background: "白底或浅色背景，允许场景图",
    promptSuffix:
      "clean product photography, diffuse soft lighting, product fills at least 50% of frame, no harsh shadows",
    notes: [
      "规则最宽松的平台之一",
      "允许场景图直接作主图",
      "最多可上传 12 张图片",
    ],
    languages: [
      { code: "en", label: "English", labelZh: "英语" },
      { code: "de", label: "Deutsch", labelZh: "德语" },
      { code: "fr", label: "Français", labelZh: "法语" },
      { code: "es", label: "Español", labelZh: "西班牙语" },
    ],
  },
  WALMART: {
    platform: "WALMART",
    name: "Walmart",
    publishable: false,
    dimensions: "1500 × 1500 px",
    width: 1500,
    height: 1500,
    ratio: "1:1",
    formats: ["JPEG", "PNG", "BMP"],
    maxFileSize: "5 MB",
    maxImages: 10,
    background: "必须纯白背景，无倒影",
    promptSuffix:
      "pure white background, no reflections, product centered, professional studio lighting, product fills 80% of frame",
    notes: [
      "主图禁止出现模特（服装类除外）",
      "图片需通过 AI 自动审核",
      "服装类可用 3:4 竖图",
    ],
    languages: [{ code: "en", label: "English", labelZh: "英语" }],
  },
  ETSY: {
    platform: "ETSY",
    name: "Etsy",
    publishable: false,
    dimensions: "2000 × 2000 px",
    width: 2000,
    height: 2000,
    ratio: "1:1",
    formats: ["JPEG", "PNG"],
    maxFileSize: "10 MB",
    maxImages: 10,
    background: "风格化场景或干净背景",
    promptSuffix:
      "warm natural lighting, lifestyle setting, handcrafted aesthetic, cozy atmosphere, artisanal feel",
    notes: [
      "Etsy 买家偏爱生活化场景图",
      "手工艺品适合展示细节纹理",
      "避免过于商业化风格",
    ],
    languages: [
      { code: "en", label: "English", labelZh: "英语" },
      { code: "de", label: "Deutsch", labelZh: "德语" },
      { code: "fr", label: "Français", labelZh: "法语" },
    ],
  },
  MERCADO_LIBRE: {
    platform: "MERCADO_LIBRE",
    name: "Mercado Libre",
    publishable: false,
    dimensions: "1200 × 1200 px",
    width: 1200,
    height: 1200,
    ratio: "1:1",
    formats: ["JPEG", "PNG"],
    maxFileSize: "5 MB",
    maxImages: 10,
    background: "必须纯白背景",
    promptSuffix:
      "pure white background, product isolated, commercial photography, no decorations, no shadows",
    notes: [
      "主图必须纯白底无阴影",
      "商品必须占图片 65% 以上",
      "禁止水印、Logo、文字",
    ],
    languages: [
      { code: "es", label: "Español", labelZh: "西班牙语" },
      { code: "pt", label: "Português", labelZh: "葡萄牙语" },
    ],
  },
  LAZADA: {
    platform: "LAZADA",
    name: "Lazada",
    publishable: false,
    dimensions: "1000 × 1000 px",
    width: 1000,
    height: 1000,
    ratio: "1:1",
    formats: ["JPEG", "PNG"],
    maxFileSize: "3 MB",
    maxImages: 8,
    background: "纯白或浅色背景",
    promptSuffix:
      "clean white background, product only, commercial photography, no reflections, product fills 80% of frame",
    notes: [
      "商品需占图片空间 80% 以上",
      "禁止边框、水印、倒影、文字",
      "服装类可用 2:3 竖图",
    ],
    languages: [
      { code: "th", label: "ไทย", labelZh: "泰语" },
      { code: "en", label: "English", labelZh: "英语" },
      { code: "id", label: "Bahasa Indonesia", labelZh: "印尼语" },
      { code: "vi", label: "Tiếng Việt", labelZh: "越南语" },
      { code: "zh", label: "中文", labelZh: "中文" },
    ],
  },
  SHOPEE: {
    platform: "SHOPEE",
    name: "Shopee",
    publishable: false,
    dimensions: "1024 × 1024 px",
    width: 1024,
    height: 1024,
    ratio: "1:1",
    formats: ["JPEG", "PNG"],
    maxFileSize: "2 MB",
    maxImages: 9,
    background: "白底或浅色背景",
    promptSuffix:
      "clean product photography, white or light background, product fills 70% of frame, no watermarks no collage",
    notes: [
      "商品需占图片空间 70% 以上",
      "禁止拼贴图、水印、过多文字",
      "东南亚最大电商平台",
    ],
    languages: [
      { code: "zh", label: "中文", labelZh: "中文" },
      { code: "en", label: "English", labelZh: "英语" },
      { code: "th", label: "ไทย", labelZh: "泰语" },
      { code: "id", label: "Bahasa Indonesia", labelZh: "印尼语" },
      { code: "vi", label: "Tiếng Việt", labelZh: "越南语" },
    ],
  },

  // ── 国内平台 (download-only) ──
  TAOBAO: {
    platform: "TAOBAO",
    name: "淘宝",
    publishable: false,
    dimensions: "800 × 800 px",
    width: 800,
    height: 800,
    ratio: "1:1",
    formats: ["JPG", "PNG"],
    maxFileSize: "20 MB",
    maxImages: 5,
    background: "纯白背景，无水印无Logo",
    promptSuffix:
      "pure white background, product centered, clean studio lighting, no watermark no logo, Chinese e-commerce style",
    notes: [
      "需要 1:1 主图 + 3:4 主图 + 白底图 + SKU图",
      "单文件上限已提升至 20MB",
      "2025年上线画质检测，低质图将被拦截",
    ],
    languages: [{ code: "zh", label: "中文", labelZh: "中文" }],
  },
  TMALL: {
    platform: "TMALL",
    name: "天猫",
    publishable: false,
    dimensions: "800 × 800 px",
    width: 800,
    height: 800,
    ratio: "1:1",
    formats: ["JPG", "PNG"],
    maxFileSize: "3 MB",
    maxImages: 5,
    background: "纯白背景，无水印无Logo",
    promptSuffix:
      "pure white background, premium product photography, luxury e-commerce style, no watermark, clean and minimal",
    notes: [
      "必须提供 800×800 PNG 透明背景产品图",
      "主图须为实拍图，禁止效果图",
      "品质要求高于淘宝，偏品牌化",
    ],
    languages: [{ code: "zh", label: "中文", labelZh: "中文" }],
  },
  JD: {
    platform: "JD",
    name: "京东",
    publishable: false,
    dimensions: "800 × 800 px",
    width: 800,
    height: 800,
    ratio: "1:1",
    formats: ["JPG", "PNG"],
    maxFileSize: "3 MB",
    maxImages: 6,
    background: "白底纯净，无大面积文字",
    promptSuffix:
      "pure white background, clean product photography, no text overlay, professional studio lighting, premium quality",
    notes: [
      "最多 6 张主图",
      "首张主图必须白底纯净",
      "主图视频建议 1:1 (1080×1080)，≤30秒",
    ],
    languages: [{ code: "zh", label: "中文", labelZh: "中文" }],
  },
  PINDUODUO: {
    platform: "PINDUODUO",
    name: "拼多多",
    publishable: false,
    dimensions: "750 × 750 px",
    width: 750,
    height: 750,
    ratio: "1:1",
    formats: ["JPG", "PNG"],
    maxFileSize: "3 MB",
    maxImages: 10,
    background: "白底为主，可有适度场景",
    promptSuffix:
      "clean white background, product centered and large, affordable e-commerce style, simple and clear",
    notes: [
      "商品主体占比 ≥ 80%",
      "主图文字占比 ≤ 20%，避免牛皮癣判定",
      "支持适度促销文案，但不能遮挡商品",
    ],
    languages: [{ code: "zh", label: "中文", labelZh: "中文" }],
  },
  DOUYIN: {
    platform: "DOUYIN",
    name: "抖音小店",
    publishable: false,
    dimensions: "800 × 800 px",
    width: 800,
    height: 800,
    ratio: "1:1",
    formats: ["JPG", "PNG"],
    maxFileSize: "5 MB",
    maxImages: 5,
    background: "纯白背景或干净场景图",
    promptSuffix:
      "pure white background, product centered, natural lighting, real product photography style, no watermark, no heavy text overlay",
    notes: [
      "首图必须为实物图，不得使用效果图",
      "文字占图片比例 ≤ 10%",
      "需多角度展示，不能同一角度",
      "可上传 3:4 竖版主图 (750×1000)",
    ],
    languages: [{ code: "zh", label: "中文", labelZh: "中文" }],
  },
};

/** Flat list of all platforms with publishable flag, usable by selectors */
export const PLATFORM_LIST = Object.values(PLATFORM_SPECS);

/** Publishable platforms only */
export const PUBLISHABLE_PLATFORMS = PLATFORM_LIST.filter((p) => p.publishable);

export function getPlatformSpec(platform: string): PlatformImageSpec | undefined {
  return PLATFORM_SPECS[platform];
}
