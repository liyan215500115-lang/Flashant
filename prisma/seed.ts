import { PrismaClient, PlanTier } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Prompt Templates (5 preset styles) ────────────────────────────
  const templates = [
    {
      name: "White Background",
      nameZh: "纯白背景",
      description:
        "Clean white background product shot, perfect for marketplace main images",
      descriptionZh: "干净纯白背景产品图，适合电商平台主图",
      category: "white_bg",
      prompt:
        "Professional product photography on pure white background, studio lighting, sharp focus, no shadows on background, commercial quality, 8k resolution",
      sortOrder: 0,
    },
    {
      name: "Marble Surface",
      nameZh: "大理石台面",
      description:
        "Elegant marble counter setting, ideal for premium product presentation",
      descriptionZh: "优雅大理石台面场景，适合高端产品展示",
      category: "marble",
      prompt:
        "Product placed on elegant white marble surface, soft natural window light, shallow depth of field, luxury aesthetic, professional product photography",
      sortOrder: 1,
    },
    {
      name: "Outdoor Natural",
      nameZh: "户外自然光",
      description:
        "Natural outdoor setting with greenery, perfect for lifestyle brands",
      descriptionZh: "自然户外场景，绿色植物背景，适合生活方式品牌",
      category: "outdoor",
      prompt:
        "Product in natural outdoor setting, golden hour sunlight, blurred green foliage background, lifestyle photography style, warm tones, candid feel",
      sortOrder: 2,
    },
    {
      name: "Studio Light",
      nameZh: "影棚布光",
      description:
        "Professional studio setup with dramatic lighting, ideal for fashion and cosmetics",
      descriptionZh: "专业影棚布光效果，戏剧性光影，适合时尚美妆产品",
      category: "studio",
      prompt:
        "Professional studio product shot, dramatic key light with soft fill, dark moody background, rim lighting, high-end commercial photography, magazine quality",
      sortOrder: 3,
    },
    {
      name: "Lifestyle Scene",
      nameZh: "生活场景",
      description:
        "Realistic lifestyle scene showing product in use, connects with customers emotionally",
      descriptionZh: "真实生活场景展示产品使用情境，与客户建立情感连接",
      category: "lifestyle",
      prompt:
        "Natural lifestyle scene showing product in real use context, warm home or cafe environment, candid photography style, relatable and authentic, soft natural lighting",
      sortOrder: 4,
    },
  ];

  for (const t of templates) {
    await prisma.promptTemplate.upsert({
      where: { id: `seed_${t.category}` },
      update: t,
      create: { id: `seed_${t.category}`, ...t },
    });
  }
  console.log(`Seeded ${templates.length} prompt templates`);

  // ── Demo User ─────────────────────────────────────────────────────
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@shanxiang.ai" },
    update: {},
    create: {
      email: "demo@shanxiang.ai",
      name: "Demo User",
      role: "user",
    },
  });

  await prisma.subscription.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      planTier: PlanTier.FREE,
    },
  });

  console.log(`Seeded demo user: ${demoUser.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
