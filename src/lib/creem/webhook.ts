import "server-only";

import { db } from "@/lib/db";
import { planTierForCreemProduct } from "@/lib/creem/products";
import type { PlanTier, SubscriptionStatus } from "@prisma/client";

export type CreemWebhookResult = "handled" | "skipped" | "duplicate" | "stale";

export interface CreemWebhookEvent {
  id?: string;
  eventType?: string;
  created_at?: number;
  object?: Record<string, unknown>;
}

const GRANT_EVENTS = new Set([
  "checkout.completed",
  "subscription.active",
  "subscription.paid",
  "subscription.trialing",
]);

const KNOWN_EVENTS = new Set([
  ...GRANT_EVENTS,
  "subscription.canceled",
  "subscription.scheduled_cancel",
  "subscription.past_due",
  "subscription.expired",
  "subscription.unpaid",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readEntityId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  const record = asRecord(value);
  if (record && typeof record.id === "string" && record.id.trim()) return record.id.trim();
  return null;
}

function readUserId(metadata: unknown): string | null {
  const record = asRecord(metadata);
  if (!record) return null;
  for (const key of ["referenceId", "user_id", "userId"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function isUniqueConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

interface CreemContext {
  productId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  userId: string | null;
  periodStart?: Date;
  periodEnd?: Date;
}

function extractContext(eventType: string, object: Record<string, unknown>): CreemContext {
  const checkout = eventType === "checkout.completed" || object.object === "checkout";
  const subscription = checkout ? asRecord(object.subscription) : object;
  const productId =
    readEntityId(object.product) ??
    (subscription ? readEntityId(subscription.product) : null);
  const customerId =
    readEntityId(checkout ? object.customer : object.customer) ??
    (subscription ? readEntityId(subscription.customer) : null);
  const subscriptionId = checkout
    ? readEntityId(object.subscription)
    : typeof object.id === "string"
      ? object.id
      : null;
  const userId =
    readUserId(object.metadata) ??
    (subscription ? readUserId(subscription.metadata) : null);

  return {
    productId,
    customerId,
    subscriptionId,
    userId,
    periodStart: parseDate(subscription?.current_period_start_date),
    periodEnd: parseDate(subscription?.current_period_end_date),
  };
}

async function resolveUserId(context: CreemContext): Promise<string | null> {
  if (context.userId) return context.userId;
  if (context.subscriptionId) {
    const bySubscription = await db.subscription.findFirst({
      where: { billingSubscriptionId: context.subscriptionId },
      select: { userId: true },
    });
    if (bySubscription) return bySubscription.userId;
  }
  if (context.customerId) {
    const byCustomer = await db.subscription.findFirst({
      where: { billingCustomerId: context.customerId },
      select: { userId: true },
    });
    if (byCustomer) return byCustomer.userId;
  }
  return null;
}

async function rememberEvent(id: string, eventType: string): Promise<"stored" | "duplicate"> {
  try {
    await db.billingWebhookEvent.create({
      data: { id, provider: "creem", eventType },
    });
    return "stored";
  } catch (error) {
    if (isUniqueConflict(error)) return "duplicate";
    throw error;
  }
}

export async function handleCreemWebhookEvent(
  event: CreemWebhookEvent
): Promise<CreemWebhookResult> {
  const eventId = event.id?.trim();
  const eventType = event.eventType?.trim();
  const object = event.object;
  if (!eventId || !eventType || !object) return "skipped";

  const seen = await db.billingWebhookEvent.findUnique({ where: { id: eventId } });
  if (seen) return "duplicate";

  if (!KNOWN_EVENTS.has(eventType)) {
    await rememberEvent(eventId, eventType);
    return "skipped";
  }

  const context = extractContext(eventType, object);
  const userId = await resolveUserId(context);
  if (!userId) {
    throw new Error(`Creem webhook ${eventType} (${eventId}) has no Flashant user id`);
  }

  const eventAt = new Date(
    typeof event.created_at === "number" && Number.isFinite(event.created_at)
      ? event.created_at
      : Date.now()
  );
  const current = await db.subscription.findUnique({
    where: { userId },
    select: { billingEventAt: true },
  });
  if (current?.billingEventAt && eventAt.getTime() < current.billingEventAt.getTime()) {
    await rememberEvent(eventId, eventType);
    return "stale";
  }

  if (GRANT_EVENTS.has(eventType)) {
    if (!context.productId) {
      throw new Error(`Creem webhook ${eventType} (${eventId}) is missing a product id`);
    }
    const planTier = planTierForCreemProduct(context.productId);
    if (!planTier) {
      throw new Error(
        `Creem product ${context.productId} is not mapped. Set CREEM_PRODUCT_ID_* and retry the webhook.`
      );
    }
    const status: SubscriptionStatus =
      eventType === "subscription.trialing" ? "TRIALING" : "ACTIVE";
    const data = {
      billingProvider: "creem",
      billingPriceId: context.productId,
      planTier: planTier as PlanTier,
      status,
      currentPeriodStart: context.periodStart ?? eventAt,
      currentPeriodEnd: context.periodEnd,
      cancelAtPeriodEnd: false,
      billingEventAt: eventAt,
      ...(context.subscriptionId ? { billingSubscriptionId: context.subscriptionId } : {}),
      ...(context.customerId ? { billingCustomerId: context.customerId } : {}),
    };
    await db.subscription.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  } else if (eventType === "subscription.scheduled_cancel") {
    await db.subscription.updateMany({
      where: { userId },
      data: {
        cancelAtPeriodEnd: true,
        billingProvider: "creem",
        billingEventAt: eventAt,
        ...(context.periodEnd ? { currentPeriodEnd: context.periodEnd } : {}),
        ...(context.subscriptionId ? { billingSubscriptionId: context.subscriptionId } : {}),
      },
    });
  } else if (eventType === "subscription.canceled") {
    const keepAccess = Boolean(context.periodEnd && context.periodEnd.getTime() > Date.now());
    await db.subscription.updateMany({
      where: { userId },
      data: {
        status: "CANCELED",
        cancelAtPeriodEnd: keepAccess,
        billingProvider: "creem",
        billingEventAt: eventAt,
        ...(keepAccess ? {} : { planTier: "FREE" }),
        ...(context.periodEnd ? { currentPeriodEnd: context.periodEnd } : {}),
        ...(context.subscriptionId ? { billingSubscriptionId: context.subscriptionId } : {}),
      },
    });
  } else if (eventType === "subscription.past_due") {
    await db.subscription.updateMany({
      where: { userId },
      data: {
        status: "PAST_DUE",
        billingProvider: "creem",
        billingEventAt: eventAt,
        ...(context.periodEnd ? { currentPeriodEnd: context.periodEnd } : {}),
        ...(context.subscriptionId ? { billingSubscriptionId: context.subscriptionId } : {}),
      },
    });
  } else if (eventType === "subscription.expired" || eventType === "subscription.unpaid") {
    await db.subscription.updateMany({
      where: { userId },
      data: {
        status: eventType === "subscription.unpaid" ? "UNPAID" : "CANCELED",
        planTier: "FREE",
        cancelAtPeriodEnd: false,
        billingProvider: "creem",
        billingEventAt: eventAt,
        ...(context.periodEnd ? { currentPeriodEnd: context.periodEnd } : {}),
        ...(context.subscriptionId ? { billingSubscriptionId: context.subscriptionId } : {}),
      },
    });
  }

  const stored = await rememberEvent(eventId, eventType);
  if (stored === "duplicate") return "duplicate";
  return "handled";
}
