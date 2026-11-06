# Flashant Preview — Lemon 测试支付

生产保持冻结。本分支只用于 Vercel Preview + Lemon **test mode**。不要合并到 `main`，不要在 Vercel 上点 Promote to Production，不要改 Production 环境变量，不要把 Lemon **live** webhook 指到别的地址。

SKU-A v6 锚点包和首页原图 v6 锁版不在本分支里，不要随这次预发部署。

当前基线：`main` @ `2a6ab9ca6a3cff8267dced23dd29c8252651a019`。生产站点仍是 https://flashant.vercel.app 。

## 这条分支做了什么

- Preview / 误触发的 Production 构建**不会**执行 `prisma db push --accept-data-loss`。`VERCEL_ENV=production` 时构建直接跳过。
- Preview 上的 checkout 带 `test_mode: true`，成功/取消回跳到该次 Preview 主机，不回跳 `NEXT_PUBLIC_APP_URL`。
- Preview webhook 只对 `meta.test_mode === true` 开权。已知生产库主机 `ep-lingering-unit-ahm7ojop` 上直接跳过，不写订阅。
- 开权逻辑本身没改：`order_created` 仍把 `Subscription.planTier` 写成 `PRO`、`status` 写成 `ACTIVE`。Business 档位映射保持原样。

## 还没做、必须由人做的事

代码里没有 Lemon 密钥，也没有改 Vercel Production。Preview URL 要等这个 draft PR 触发 Vercel 之后才存在。下面整段做完之前，不要在 Lemon 里保存 webhook。

### 1. 单独的预发数据库

在 Neon 从当前生产分支拉一条 **branch**（拷贝 schema 即可）。把这条 branch 的连接串记下来。

停手条件：主机名里如果还有 `ep-lingering-unit-ahm7ojop`，那就是生产库，不要继续。

不要对生产库跑 `prisma db push` 或 `migrate`。预发 branch 如果是从生产分支拉出来的，schema 已经在，不需要 push。

### 2. 只在 Vercel Preview 环境写入这些变量

项目：`flashant`（`liyan215500115-langs-projects`）。每一项的 Environment 只勾 **Preview**。不要勾 Production，不要编辑已经存在的 Production 值。

| 变量 | Preview 值 |
|---|---|
| `DATABASE_URL` | 第 1 步的 Neon **branch** 连接串 |
| `DIRECT_URL` | 同上。应用先读 `DIRECT_URL`。如果 Preview 继承了生产的 `DIRECT_URL`，只改 `DATABASE_URL` 不够，开权会被锁住 |
| `LEMONSQUEEZY_API_KEY` | Lemon **Test mode** 里创建的 API key。不要用 live key |
| `LEMONSQUEEZY_STORE_ID` | 同一个店的 store id |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | 下面第 4 步新建的 **test** webhook signing secret |
| `NEXT_PUBLIC_LEMONSQUEEZY_PRO_VARIANT_ID` | Test mode 里 Pro 商品的 variant id |
| `NEXT_PUBLIC_LEMONSQUEEZY_BUSINESS_VARIANT_ID` | Test mode 里 Business 商品的 variant id |
| `FLASHANT_PREVIEW_BILLING` | `1`。这是预发开权开关。生产库主机上即使设成 1 也不会写 |
| `AUTH_SECRET` | 新生成的 `openssl rand -hex 32`。不要拿去覆盖 Production |
| `AUTH_URL` | `https://<preview-branch-alias>`（第 3 步拿到 URL 后再写） |
| `NEXTAUTH_URL` | 与 `AUTH_URL` 相同 |
| `NEXT_PUBLIC_APP_URL` | 与 `AUTH_URL` 相同 |

`NEXT_PUBLIC_*` 在构建时写进客户端。改完 variant id 或 `NEXT_PUBLIC_APP_URL` 之后，要 **Redeploy 这个 Preview**，不要 Redeploy Production。

Test mode 商品用 Dashboard 的 Test mode 开关单独建或单独看。不要点 “Copy to Live Mode”。

### 3. 确认 Preview URL

打开本 PR 的 Vercel 检查，或部署列表里 Environment = Preview 的那条。要用 **branch alias**（随这条分支更新），不要用 https://flashant.vercel.app 。

部署主机如果是 `flashant.vercel.app`，停手。那是生产。

就绪探针（不返回任何密钥）：

```text
GET https://<preview-branch-alias>/api/webhooks/lemonsqueezy
```

可以继续之前，JSON 必须是：

- `environment` = `preview`
- `productionDatabaseLocked` = `false`
- `databaseConfigured` = `true`
- `billingArmed` = `true`
- `webhookSecretConfigured` = `true`
- `lemonApiKeyConfigured` = `true`
- `lemonStoreConfigured` = `true`

`productionDatabaseLocked: true` 或响应只有 `{ "ok": true }`（说明不是 Preview）时，停手，不要配 webhook。

### 4. 把 Lemon test webhook 指到 Preview

1. Lemon Squeezy → 打开 **Test mode**。
2. Settings → Webhooks → 新建一条，不要改已经指向 `https://flashant.vercel.app/api/webhooks/lemonsqueezy` 的 live webhook。
3. Callback URL：

```text
https://<preview-branch-alias>/api/webhooks/lemonsqueezy
```

4. Signing secret：随机字符串（Lemon 要求约 6–40 字符）。把**同一串**写入 Vercel Preview 的 `LEMONSQUEEZY_WEBHOOK_SECRET`，然后只 Redeploy Preview。
5. 勾选事件：`order_created`、`subscription_updated`、`subscription_cancelled`。`order_created` 才是开权事件。
6. 保存这条 test webhook。签名对不上时，Preview 会回 `401`（Vercel 上 `NODE_ENV` 是 production，不会跳过验签）。

### 5. 冒烟：选套餐 → checkout → webhook → 开权

用预发库里的新账号。不要拿生产顾客去付。

1. 打开 `https://<preview-branch-alias>` ，注册并登录。
2. 打开 `/settings/billing`。
3. 选 **Pro**（或 Business）。点升级。
4. 应用 `POST /api/lemonsqueezy/checkout`。Preview 在未武装或仍指向生产库时回 `409`，不会向 Lemon 下单。通过时响应里的 `url` 是 Lemon checkout，请求体带 `test_mode: true`。
5. 在该 URL 支付。只用测试卡：`4242 4242 4242 4242`，有效期 `12/35`，CVC `123`。不要用真卡。
6. Lemon 向第 4 步的 URL 发 `order_created`。`meta.test_mode` 为 `true`，`meta.custom_data.user_id` 是刚才登录的用户 id，`X-Signature` 用 Preview 的 signing secret。
7. 应用验签后写入 `Subscription`：`planTier=PRO`，`status=ACTIVE`，`billingCustomerId` / `billingSubscriptionId` 来自该事件。
8. 刷新 `/settings/billing`。当前套餐应显示 Pro。这就是开权完成。

未武装时 test webhook 回 `503` `preview_billing_not_armed`，Lemon 会重试。配好并 Redeploy Preview 后，如果重试窗口过了，在 Lemon 里对那条 `order_created` 点 Resend。不要 Resend 到生产 URL。

Business 按钮今天仍会开成 Pro。这是原 handler 的行为，这条预发分支没有改开权映射。

## 明确不要做

- 合并这个 PR，或把 Preview deployment Promote 到 Production。
- 修改 Vercel Production 的任何变量，或运行 `scripts/deploy.sh` / `vercel --prod`。
- 改 live webhook 的 URL 或 signing secret。
- 对主机 `ep-lingering-unit-ahm7ojop` 跑迁移、`db push`，或让 Preview 的 `DATABASE_URL` / `DIRECT_URL` 指向它。
- 部署或替换 SKU-A v6 锚点图、首页 v6 锁版。
