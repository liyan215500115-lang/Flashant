# Creem billing (Flashant)

Creem is the Merchant of Record for Flashant. The seller is an individual (个人卖家), not a company. Lemon Squeezy stays in the repo until Creem is armed. This branch does not deploy to production and must not change Production Vercel env or the production Neon database.

Chinese summary: 在 Creem 后台用 **Test Mode** 建 Pro / Business 订阅商品，把测试环境变量只配到 **Preview**，webhook 指到 Preview 的 `/api/webhooks/creem`。`BILLING_PROVIDER=creem` 才会真正改套餐。不要对生产库执行迁移，也不要改生产环境变量。域名 `flashant.cn` 还没生效，先用 Preview URL。

## Kill switch

| `BILLING_PROVIDER` | Checkout | Webhooks that change the plan |
| --- | --- | --- |
| unset or `lemonsqueezy` | Lemon Squeezy | Lemon only. A valid Creem webhook returns 503 so Creem retries after you arm Creem. |
| `creem` | Creem | Creem only. Lemon webhooks are acknowledged and ignored. |

Upgrade buttons call `POST /api/billing/checkout`. The server picks the provider. Product ids stay on the server (`CREEM_PRODUCT_ID_*`), not in `NEXT_PUBLIC_*`.

## Environment

Set these on the Preview environment only.

| Variable | Required to take a test payment | Purpose |
| --- | --- | --- |
| `BILLING_PROVIDER` | yes | `creem` |
| `CREEM_API_KEY` | yes | Test-mode API key. Sent as `x-api-key`. |
| `CREEM_WEBHOOK_SECRET` | yes | HMAC secret for `creem-signature`. |
| `CREEM_TEST_MODE` | yes for Preview | `true` calls `https://test-api.creem.io/v1`. A key that contains `test` also selects the test API when this is unset. |
| `CREEM_PRODUCT_ID_PRO_MONTHLY` | yes | Creem product id for Pro monthly. `CREEM_PRODUCT_ID_PRO` is a fallback. |
| `CREEM_PRODUCT_ID_BUSINESS_MONTHLY` | yes | Creem product id for Business monthly. `CREEM_PRODUCT_ID_BUSINESS` is a fallback. |
| `CREEM_PRODUCT_ID_PRO_ANNUAL` | only for annual | Annual toggle is hidden until both annual ids are set. |
| `CREEM_PRODUCT_ID_BUSINESS_ANNUAL` | only for annual | Same as above. |
| `CREEM_SUCCESS_URL` | no | Defaults to `$NEXT_PUBLIC_APP_URL/settings/billing?success=true`. |
| `CREEM_CANCEL_URL` | no | In-app page after an abandoned checkout. Creem's create-checkout API accepts `success_url` only. |
| `CREEM_API_BASE_URL` | no | Full override, including `/v1`. |
| `CREEM_MODERATION` | no | Leave unset. `enforce` screens user prompts before generation. See the review note below. |
| `NEXT_PUBLIC_APP_URL` | yes | Preview origin, used to build the success URL. |

`vercel-build` runs `prisma db push`. Do not attach the production `DATABASE_URL` to a deployment of this branch. Apply `prisma/migrations/20261108000000_creem_billing` on the Preview database only (adds `Subscription.billingProvider`, `Subscription.billingEventAt`, and `BillingWebhookEvent`).

## Create Test products

1. Open the Creem store **FlashantAI** and turn on **Test Mode** (bottom of the left sidebar). Test and live data are separate. Keys are not interchangeable.
2. Create two subscription products (recurring, not one-time):
   - **Pro**, monthly. Quota after payment: 100 generations / month.
   - **Business**, monthly. Quota after payment: 600 generations / month.
   Optional: Pro annual and Business annual. Prices in the UI are $19/mo and $59/mo ($190/yr and $590/yr). Match those in Creem or the page and the receipt will disagree.
3. Copy each product id (`prod_...`) into the env vars above.
4. Developers → API keys: create a **test** key and set `CREEM_API_KEY`.
5. Developers → Webhooks: endpoint `https://<preview-host>/api/webhooks/creem`. Subscribe at least to `checkout.completed`, `subscription.active`, `subscription.paid`, `subscription.canceled`, `subscription.past_due`, `subscription.expired`. Also enable `subscription.scheduled_cancel` and `subscription.unpaid` if the dashboard lists them. Copy the signing secret to `CREEM_WEBHOOK_SECRET`.

The app stores `metadata.referenceId` (the Flashant user id) on the checkout. Creem copies that metadata onto the subscription. That is how a payment is attached to the logged-in user.

## What the webhook does

`POST /api/webhooks/creem` checks `creem-signature` (HMAC-SHA256 of the raw body, hex). Invalid signatures return 401. Missing secret returns 500. Processing is idempotent: the Creem event id is stored in `BillingWebhookEvent`, and an older `created_at` does not overwrite a newer subscription update.

| Event | Plan effect |
| --- | --- |
| `checkout.completed`, `subscription.active`, `subscription.paid` | `ACTIVE` plus Pro or Business from the product id. Period dates come from the subscription object. |
| `subscription.trialing` | Same mapping, status `TRIALING`. |
| `subscription.scheduled_cancel` | Keep the paid tier. `cancelAtPeriodEnd` is set. |
| `subscription.canceled` | Keep the paid tier until `current_period_end_date` if that date is still in the future. Otherwise Free. |
| `subscription.past_due` | Status `PAST_DUE`. The paid tier stays so the buyer can update their card. |
| `subscription.expired` | Free, status `CANCELED`. |
| `subscription.unpaid` | Free, status `UNPAID`. |

An unknown product id or a missing user id returns 500 so Creem retries after the env or metadata is fixed. It does not grant Pro by default.

`/api/quota` and the billing page both use `resolveEffectivePlan`. A Pro subscription reports `PRO`, not `ENTERPRISE`. Unlimited (`ENTERPRISE`, limit `-1`) is only the stored Enterprise tier.

The customer portal (`POST /api/billing/portal`) is available after the first Creem payment links a `cust_...` id. Buyers cancel or update the card there. There is no in-app "contact the company" downgrade.

## Smoke test (Preview)

1. Set the Preview env vars, including `BILLING_PROVIDER=creem` and `CREEM_TEST_MODE=true`. Redeploy Preview. Do not promote to production.
2. Migrate the Preview database only.
3. Sign in, open **Settings → Plan & Usage**, and choose **Upgrade to Pro**.
4. Pay with Creem's test card **4111 1111 1111 1111**, any future expiry, any CVC, any billing details. Declined: `4507 9900 0000 0028`.
5. Creem redirects to `/settings/billing?success=true`. After the webhook, the badge shows **Pro**, `/api/quota` returns `"tier": "PRO"` and `"limit": 100`, and **Manage subscription** opens the Creem portal.
6. Resend the same webhook from the Creem dashboard. The handler returns `duplicate` and does not double-apply.

## Account review (do not block checkout)

Creem's review for AI image products expects the [Moderation API](https://docs.creem.io/features/moderation) before live charges. Contact support@creem.io before review. `flashant.cn` still needs to be the verified store domain.

TODO: before asking for live mode, set `CREEM_MODERATION=enforce`. That calls `POST /v1/moderation/prompt` for user-written prompts on `/api/generate` and `/api/generate/batch`. Decisions other than `allow`, and API errors, stop generation (fail closed). Leave the variable unset until then. Checkout, webhooks, and quotas do not wait on moderation.

Template-only generations that have no user prompt string are not screened yet. Before review, pass the final prompt that reaches the model into `screenGenerationPrompts` at each `createPrediction` call.

## Code map

- `src/lib/creem/client.ts` — `POST /v1/checkouts`, `POST /v1/customers/billing`
- `src/lib/creem/webhook.ts` — plan updates
- `src/app/api/webhooks/creem/route.ts` — signature and kill switch
- `src/app/api/billing/checkout/route.ts` — upgrade buttons
- `src/lib/billing/quota.ts` — shared quota used by `/api/quota` and generation
