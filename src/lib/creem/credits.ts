import type { ModerationGate } from "@/lib/creem/moderation";

/**
 * Monthly generation credits. These match TIER_LIMITS and the public
 * "X / month" plan copy. ENTERPRISE stays -1: there is no accepted monthly
 * amount, so this PR does not invent one.
 */
export const GENERATION_ALLOTMENT = {
  FREE: 10,
  PRO: 100,
  BUSINESS: 600,
  ENTERPRISE: -1,
} as const;

export type GenerationTier = keyof typeof GENERATION_ALLOTMENT;

/**
 * Lemon Squeezy still owns checkout. Creem product Delivery is not crediting
 * Pro or Business yet, so the app tops the generation wallet up to the monthly
 * allotment from the local planTier (not from a purchase webhook).
 *
 * TURN THIS OFF before Creem Delivery starts auto-crediting Pro and Business
 * purchases or renewals. Leaving it on double-credits those plans. The Free
 * 10-credit monthly grant stays on: there is no Free product Delivery, and
 * purchase webhooks must not grant Free credits.
 */
export const LEMON_PAID_TIER_MONTHLY_GRANT = true;

export const GENERATION_WALLET_NAME = "generation";
export const CREDIT_UNIT_LABEL = "credits";
const MODERATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const EXTERNAL_ID = /^[A-Za-z0-9_.:-]{1,255}$/;

export interface CreditCustomer {
  id: string;
  externalId?: string | null;
}

export interface CreditAccount {
  id: string;
  name: string;
  status: string;
}

export interface CreditsApi {
  retrieveCustomerByEmail(email: string): Promise<CreditCustomer | null>;
  createCustomer(input: { email: string; name: string; externalId: string }): Promise<CreditCustomer>;
  updateCustomerExternalId(customerId: string, externalId: string): Promise<void>;
  listAccounts(customerId: string): Promise<CreditAccount[]>;
  createGenerationAccount(customerId: string): Promise<CreditAccount>;
  getBalance(accountId: string): Promise<string>;
  credit(
    accountId: string,
    input: { amount: string; reference: string; idempotencyKey: string },
  ): Promise<{ id: string }>;
  debit(
    accountId: string,
    input: { amount: string; reference: string; idempotencyKey: string; moderationId: string },
  ): Promise<{ id: string }>;
  reverse(accountId: string, transactionId: string): Promise<{ id: string }>;
}

export interface CreditUser {
  id: string;
  email: string | null;
  name: string | null;
  tier: GenerationTier;
  periodStart: Date | null;
}

export interface DebitHold {
  accountId: string;
  transactionId: string;
  amount: number;
  moderationId: string;
  reference: string;
  idempotencyKey: string;
}

export type ChargeSuccess = {
  ok: true;
  hold: DebitHold;
  tier: GenerationTier;
  balance: number;
  allotmentConfigured: boolean;
};

export type ChargeFailure =
  | {
      ok: false;
      error: "insufficient_credits";
      balance: number;
      required: number;
      tier: GenerationTier;
      allotmentConfigured: boolean;
    }
  | {
      ok: false;
      error: "credits_unavailable" | "moderation_rejected";
      tier: GenerationTier;
      allotmentConfigured: boolean;
    };

export type ChargeResult = ChargeSuccess | ChargeFailure;

export interface QuotaView {
  allowed: boolean;
  used: number;
  limit: number;
  tier: GenerationTier;
  balance: number;
  allotmentConfigured: boolean;
}

export function creemSdkServerForBaseUrl(baseUrl: string): "test" | "prod" {
  return baseUrl === "https://test-api.creem.io" ? "test" : "prod";
}

export function effectivePlanTier(
  sub: { planTier: GenerationTier; status: string } | null | undefined,
): GenerationTier {
  if (!sub) return "FREE";
  if (
    sub.status === "CANCELED" ||
    sub.status === "INCOMPLETE" ||
    sub.status === "INCOMPLETE_EXPIRED" ||
    sub.status === "UNPAID"
  ) {
    return "FREE";
  }
  return sub.planTier;
}

export function grantPeriodKey(
  tier: GenerationTier,
  periodStart: Date | null,
  now = new Date(),
): string {
  if ((tier === "PRO" || tier === "BUSINESS") && periodStart && !Number.isNaN(periodStart.getTime())) {
    return `period:${periodStart.toISOString()}`;
  }
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `month:${now.getUTCFullYear()}-${month}`;
}

export function monthlyGrantKey(user: CreditUser, now = new Date()): string {
  return `grant:${user.id}:${user.tier}:${grantPeriodKey(user.tier, user.periodStart, now)}`;
}

export function parseCreditBalance(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return null;
  return parsed;
}

export function isIdempotencyConflict(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const record = err as { statusCode?: number; message?: string; error?: { code?: string | null; message?: string } };
  if (record.statusCode !== 409) return false;
  const code = `${record.error?.code ?? ""}`.toLowerCase();
  const message = `${record.message ?? ""} ${record.error?.message ?? ""}`.toLowerCase();
  if (code.includes("frozen") || code.includes("closed") || message.includes("frozen") || message.includes("closed")) {
    return false;
  }
  return code.includes("idempot") || message.includes("idempot");
}

export function isInsufficientBalance(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const record = err as { statusCode?: number; message?: string; error?: { code?: string | null; message?: string } };
  const code = `${record.error?.code ?? ""}`.toLowerCase();
  const message = `${record.message ?? ""} ${record.error?.message ?? ""}`.toLowerCase();
  return code === "insufficient_balance" || (record.statusCode === 422 && message.includes("insufficient"));
}

export function toQuotaView(input: { tier: GenerationTier; balance: number }): QuotaView {
  const balance = Number.isSafeInteger(input.balance) && input.balance > 0 ? input.balance : 0;
  const allotment = GENERATION_ALLOTMENT[input.tier];
  const allotmentConfigured = input.tier !== "ENTERPRISE" && allotment >= 0;
  if (!allotmentConfigured) {
    return {
      allowed: balance >= 1,
      used: 0,
      limit: balance,
      tier: input.tier,
      balance,
      allotmentConfigured: false,
    };
  }
  const limit = Math.max(allotment, balance);
  return {
    allowed: balance >= 1,
    used: limit - balance,
    limit,
    tier: input.tier,
    balance,
    allotmentConfigured: true,
  };
}

export function unavailableQuota(tier: GenerationTier): QuotaView {
  return {
    allowed: false,
    used: 0,
    limit: 0,
    tier,
    balance: 0,
    allotmentConfigured: tier !== "ENTERPRISE",
  };
}

export function shouldReverseSharedDebit(statuses: readonly string[]): boolean {
  return statuses.length > 0 && statuses.every((status) => status === "FAILED");
}

/** Debit hold stored on task or image metadata. Ignores user-facing error strings. */
export function readCreemDebit(meta: unknown): { accountId: string; transactionId: string } | null {
  if (!meta || typeof meta !== "object") return null;
  const debit = (meta as { creemDebit?: { accountId?: unknown; transactionId?: unknown } }).creemDebit;
  if (typeof debit?.accountId !== "string" || typeof debit.transactionId !== "string") return null;
  if (!debit.accountId || !debit.transactionId) return null;
  return { accountId: debit.accountId, transactionId: debit.transactionId };
}

function failure(tier: GenerationTier, error: "credits_unavailable" | "moderation_rejected"): ChargeFailure {
  return {
    ok: false,
    error,
    tier,
    allotmentConfigured: tier !== "ENTERPRISE" && GENERATION_ALLOTMENT[tier] >= 0,
  };
}

function insufficient(tier: GenerationTier, balance: number, required: number): ChargeFailure {
  return {
    ok: false,
    error: "insufficient_credits",
    balance,
    required,
    tier,
    allotmentConfigured: tier !== "ENTERPRISE" && GENERATION_ALLOTMENT[tier] >= 0,
  };
}

export async function findOrCreateCustomer(api: CreditsApi, user: CreditUser): Promise<string> {
  if (!EXTERNAL_ID.test(user.id)) throw new Error("invalid_external_id");
  const email = user.email?.trim();
  if (!email) throw new Error("missing_email");
  const name = user.name?.trim() || email;

  const accept = async (customer: CreditCustomer): Promise<string | null> => {
    if (!customer.externalId) {
      await api.updateCustomerExternalId(customer.id, user.id);
      return customer.id;
    }
    return customer.externalId === user.id ? customer.id : null;
  };

  const existing = await api.retrieveCustomerByEmail(email);
  if (existing) {
    const id = await accept(existing);
    if (!id) throw new Error("customer_external_id_mismatch");
    return id;
  }

  try {
    const created = await api.createCustomer({ email, name, externalId: user.id });
    return created.id;
  } catch (err) {
    const raced = await api.retrieveCustomerByEmail(email);
    if (raced) {
      const id = await accept(raced);
      if (id) return id;
    }
    throw err;
  }
}

export async function findOrCreateGenerationWallet(api: CreditsApi, customerId: string): Promise<string> {
  const pick = (accounts: CreditAccount[]) =>
    accounts.find((account) => account.name.trim().toLowerCase() === GENERATION_WALLET_NAME);

  const existing = pick(await api.listAccounts(customerId));
  if (existing) {
    if (existing.status === "frozen") throw new Error("wallet_frozen");
    if (existing.status === "closed") throw new Error("wallet_closed");
    return existing.id;
  }

  try {
    const created = await api.createGenerationAccount(customerId);
    return created.id;
  } catch (err) {
    const raced = pick(await api.listAccounts(customerId));
    if (raced && raced.status !== "frozen" && raced.status !== "closed") return raced.id;
    throw err;
  }
}

export async function ensureMonthlyGrant(
  api: CreditsApi,
  accountId: string,
  user: CreditUser,
  now = new Date(),
  paidTierMonthlyGrant = LEMON_PAID_TIER_MONTHLY_GRANT,
): Promise<{ granted: boolean; reason: string; amount: string }> {
  if (user.tier === "ENTERPRISE") {
    return { granted: false, reason: "enterprise_allotment_unconfigured", amount: "0" };
  }
  if ((user.tier === "PRO" || user.tier === "BUSINESS") && !paidTierMonthlyGrant) {
    return { granted: false, reason: "paid_grant_disabled", amount: "0" };
  }

  const allotment = GENERATION_ALLOTMENT[user.tier];
  const balance = parseCreditBalance(await api.getBalance(accountId));
  if (balance === null) throw new Error("invalid_balance");
  const shortfall = allotment - balance;
  if (shortfall <= 0) return { granted: false, reason: "at_or_above_allotment", amount: "0" };

  const reference = monthlyGrantKey(user, now);
  try {
    await api.credit(accountId, {
      amount: String(shortfall),
      reference,
      idempotencyKey: reference,
    });
    return { granted: true, reason: "credited", amount: String(shortfall) };
  } catch (err) {
    if (isIdempotencyConflict(err)) {
      return { granted: false, reason: "already_granted", amount: "0" };
    }
    throw err;
  }
}

function moderationAllowsDebit(gate: ModerationGate, now: number): boolean {
  if (gate.decision !== "allow" || !gate.moderationId || !gate.screenedAt) return false;
  if (gate.moderationId.length > 64) return false;
  const age = now - gate.screenedAt;
  return age >= 0 && age <= MODERATION_MAX_AGE_MS;
}

/**
 * Resolve the generation wallet, top it up once for this period, and debit
 * `imageCount` credits for one screened generation.
 * A low balance returns before `debit`. The debit is one call.
 */
export async function applyGenerationCharge(
  api: CreditsApi,
  input: {
    user: CreditUser;
    gate: ModerationGate;
    imageCount: number;
    reference: string;
    idempotencyKey: string;
    now?: number;
  },
): Promise<ChargeResult> {
  const now = input.now ?? Date.now();
  const tier = input.user.tier;
  if (!Number.isInteger(input.imageCount) || input.imageCount < 1) return failure(tier, "credits_unavailable");
  if (!moderationAllowsDebit(input.gate, now) || !input.gate.moderationId) {
    return failure(tier, "moderation_rejected");
  }

  let customerId: string;
  let accountId: string;
  try {
    customerId = await findOrCreateCustomer(api, input.user);
    accountId = await findOrCreateGenerationWallet(api, customerId);
    await ensureMonthlyGrant(api, accountId, input.user, new Date(now));
  } catch {
    return failure(tier, "credits_unavailable");
  }

  let balance: number | null;
  try {
    balance = parseCreditBalance(await api.getBalance(accountId));
  } catch {
    return failure(tier, "credits_unavailable");
  }
  if (balance === null) return failure(tier, "credits_unavailable");
  if (balance < input.imageCount) return insufficient(tier, balance, input.imageCount);

  try {
    const transaction = await api.debit(accountId, {
      amount: String(input.imageCount),
      reference: input.reference,
      idempotencyKey: input.idempotencyKey,
      moderationId: input.gate.moderationId,
    });
    return {
      ok: true,
      tier,
      balance: balance - input.imageCount,
      allotmentConfigured: tier !== "ENTERPRISE",
      hold: {
        accountId,
        transactionId: transaction.id,
        amount: input.imageCount,
        moderationId: input.gate.moderationId,
        reference: input.reference,
        idempotencyKey: input.idempotencyKey,
      },
    };
  } catch (err) {
    if (isInsufficientBalance(err)) return insufficient(tier, balance, input.imageCount);
    return failure(tier, "credits_unavailable");
  }
}

export async function reverseDebit(
  api: CreditsApi,
  hold: { accountId: string; transactionId: string },
): Promise<{ reversed: boolean }> {
  try {
    await api.reverse(hold.accountId, hold.transactionId);
    return { reversed: true };
  } catch {
    return { reversed: false };
  }
}

/** Debit, run the generation, and reverse that debit if `run` throws. */
export async function withGenerationDebit<T>(
  api: CreditsApi,
  input: Parameters<typeof applyGenerationCharge>[1],
  run: () => Promise<T>,
): Promise<{ ok: true; value: T; hold: DebitHold } | (ChargeFailure & { reversed?: boolean })> {
  const charged = await applyGenerationCharge(api, input);
  if (!charged.ok) return charged;
  try {
    const value = await run();
    return { ok: true, value, hold: charged.hold };
  } catch {
    const refund = await reverseDebit(api, charged.hold);
    return { ...failure(input.user.tier, "credits_unavailable"), reversed: refund.reversed };
  }
}
