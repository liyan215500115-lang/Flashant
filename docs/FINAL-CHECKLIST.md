# 闪象 上线前最终检查清单

## Vercel 环境变量（确认 16 个都在）

```
DATABASE_URL         → Neon 连接字符串 ✅
AUTH_SECRET          → 32位hex（必须）⚠️
NEXTAUTH_URL         → https://flashant.vercel.app ⚠️
NEXT_PUBLIC_APP_URL  → https://flashant.vercel.app
REPLICATE_API_KEY    → Replicate API key
DEEPSEEK_API_KEY     → DeepSeek API key
TOKEN_ENCRYPTION_KEY → 64位hex
S3_ENDPOINT          → R2 endpoint
S3_ACCESS_KEY_ID     → R2 access key
S3_SECRET_ACCESS_KEY → R2 secret key
S3_BUCKET            → flashant
S3_PUBLIC_URL        → https://pub-14cbfbb3337a48cab3436de2c2ae1cf7.r2.dev
SHOPIFY_CLIENT_ID    → Shopify OAuth
SHOPIFY_CLIENT_SECRET→ Shopify secret
TIKTOK_CLIENT_ID     → TikTok OAuth
TIKTOK_CLIENT_SECRET → TikTok secret
```

## 测试流程（隐身窗口，从零开始）

1. 打开 https://flashant.vercel.app
2. 点"免费开始" → 到注册页
3. 输入邮箱+密码 → 注册
4. 自动跳转登录 → 输入邮箱+密码 → 登录
5. 到控制台 → 点"新建项目"
6. 进入 Studio → 上传图片 → 选风格 → 点生成
7. 生成完成 → 点下载/发布
8. 退出登录 → 重新登录 → 确认项目还在

## 当前项目状态

| 功能 | 状态 |
|---|---|
| 首页 | ✅ 完成 |
| 注册/登录 | ⚠️ 依赖 Vercel AUTH_SECRET |
| 控制台 | ✅ 完成 |
| 新建项目 | ✅ 完成 |
| 上传图片 | ✅ 完成 |
| 生成图片 | ✅ 依赖 API keys |
| 发布/下载 | ✅ 完成 |
| 路由命名 | ✅ /projects |
| 字体 | ✅ Inter |
| 配色 | ✅ 品牌蓝 |
