-- Creem billing bookkeeping. Apply on the Preview database only.
-- Do not run this against the production Neon database.

ALTER TABLE "Subscription" ADD COLUMN "billingProvider" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "billingEventAt" TIMESTAMP(3);

CREATE TABLE "BillingWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingWebhookEvent_pkey" PRIMARY KEY ("id")
);
