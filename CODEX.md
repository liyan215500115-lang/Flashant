# Codex 接手 Flashant 指南

## 环境

- **Node**: v24
- **框架**: Next.js 16.2 App Router (魔改版，写代码前看 `node_modules/next/dist/docs/`)
- **数据库**: Prisma 7.8 + Neon PostgreSQL (远端，无需本地装)
- **生图**: FLUX via Replicate (主力) + GPT Image 2 via OpenAI (备选)
- **样式**: Tailwind v4 + shadcn + Base UI

## 启动

```bash
git clone git@github.com:liyan215500115-lang/Flashant.git
cd Flashant
npm install
# 拷贝 .env 到项目根目录
npm run dev    # localhost:3000
```

## 部署

```bash
./scripts/deploy.sh
```

需要代理 127.0.0.1:7897 (Clash Verge/surge) 才能连上 Vercel。

## 线上

| 项目 | 值 |
|---|---|
| Production | https://flashant.vercel.app |
| Vercel 项目 | flashant (prj_JR4ohXymOV8QWcW0bPC7yOrL1LHj) |
| 团队 | liyan215500115-langs-projects |
| 数据库 | Neon (ep-lingering-unit-ahm7ojop-pooler) |

## 关键架构

- **生成 API**: `src/app/api/generate/route.ts` — 单品 + 批量详情图
- **Prompt 模板**: `TYPE_TEMPLATES` (五要素：构图/光照/镜头/氛围/技术)
- **品类匹配**: `CATEGORY_PROFILES` — 6 个品类，每个有默认 style + 推荐类型
- **引擎路由**: `getEngineForDetailType()` — Info 类型走 GPT Image 2，场景走 FLUX
- **额度**: `src/lib/billing/quota.ts` — 按订阅套餐计额度。`BILLING_PROVIDER=creem` 时走 Creem，见 `docs/CREEM_BILLING.md`
- **套图面板**: `src/components/studio/detail-panel.tsx` — 品类选择 → 分组类型 → 一键生成

## .env 关键变量

```
REPLICATE_API_KEY    — FLUX 生图
DEEPSEEK_API_KEY     — prompt 增强
DATABASE_URL         — Neon PostgreSQL
S3_*                 — Cloudflare R2 图片存储
BILLING_PROVIDER     — creem 或 lemonsqueezy（默认）
CREEM_*              — Creem 测试支付，见 docs/CREEM_BILLING.md
LEMONSQUEEZY_*       — Lemon 支付（Creem 开启后结账与 webhook 写入会停用）
OPENAI_API_KEY       — GPT Image 2 (暂未接入)
```

## 已解决的问题

- 额度按套餐计算（`src/lib/billing/quota.ts`）。以前的 admin bypass 会让 /api/quota 一律返回 ENTERPRISE，已去掉
- 详情图超时 → 服务端轮询 50s deadline
- 删除图片 → 软删除 (status=DELETED)
- 不同页面额度不一致 → 统一显示"本月剩余 X/Y"
- Replicate 余额 → 在 replicate.com/account/billing 充值
