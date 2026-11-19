import "server-only";

import { Creem } from "creem";
import { CreemError } from "creem/models/errors";
import { db } from "@/lib/db";
import {
  applyGenerationCharge,
  creemSdkServerForBaseUrl,
  effectivePlanTier,
  ensureMonthlyGrant,
  findOrCreateCustomer,
  findOrCreateGenerationWallet,
  parseCreditBalance,
  reverseDebit,
  toQuotaView,
  unavailableQuota,
  type ChargeResult,
  type CreditsApi,
  type CreditUser,
  type DebitHold,
  type GenerationTier,
  type QuotaView,
} from "@/lib/creem/credits";
import { creemApiBaseUrl, type ModerationGate } from "@/lib/creem/moderation";

type Env = NodeJS.ProcessEnv;

function statusCode(err: unknown): number | null {
  if (err instanceof CreemError) return err.statusCode;
  if (err && typeof err === "object" && "statusCode" in err && typeof err.statusCode === "number") {
    return err.statusCode;
  }
  return null;
}

export function createSdkCreditsApi(env: Env = process.env): CreditsApi {
  const apiKey = env.CREEM_API_KEY?.trim();
  if (!apiKey) throw new Error("CREEM_API_KEY is not set");
  const client = new Creem({
    apiKey,
    server: creemSdkServerForBaseUrl(creemApiBaseUrl(env)),
  });

  return {
    async retrieveCustomerByEmail(email) {
      try {
        const customer = await client.customers.retrieve(undefined, email);
        return { id: customer.id, externalId: customer.externalId ?? null };
      } catch (err) {
        if (statusCode(err) === 404) return null;
        throw err;
      }
    },
    async createCustomer(input) {
      const customer = await client.customers.create({
        email: input.email,
        name: input.name,
        externalId: input.externalId,
      });
      return { id: customer.id, externalId: customer.externalId ?? input.externalId };
    },
    async updateCustomerExternalId(customerId, externalId) {
      await client.customers.update({ customerId, externalId });
    },
    async listAccounts(customerId) {
      const accounts: Array<{ id: string; name: string; status: string }> = [];
      let startingAfter: string | undefined;
      for (let page = 0; page < 10; page += 1) {
        const listed = await client.customerCredits.listAccounts(100, customerId, startingAfter);
        accounts.push(
          ...listed.result.data.map((account) => ({
            id: account.id,
            name: account.name,
            status: account.status,
          })),
        );
        if (!listed.result.hasMore || listed.result.data.length === 0) break;
        startingAfter = listed.result.data[listed.result.data.length - 1]?.id;
        if (!startingAfter) break;
      }
      return accounts;
    },
    async createGenerationAccount(customerId) {
      const account = await client.customerCredits.createAccount({
        customerId,
        name: "generation",
        unitLabel: "credits",
      });
      return { id: account.id, name: account.name, status: account.status };
    },
    async getBalance(accountId) {
      const balance = await client.customerCredits.getAccountBalance(accountId);
      return balance.balance;
    },
    async credit(accountId, input) {
      const transaction = await client.customerCredits.creditAccount(accountId, input);
      return { id: transaction.id };
    },
    async debit(accountId, input) {
      const transaction = await client.customerCredits.debitAccount(accountId, input);
      return { id: transaction.id };
    },
    async reverse(accountId, transactionId) {
      const transaction = await client.customerCredits.reverseTransaction(accountId, { transactionId });
      return { id: transaction.id };
    },
  };
}

async function loadCreditUser(userId: string): Promise<CreditUser> {
  const [user, sub] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } }),
    db.subscription.findUnique({ where: { userId } }),
  ]);
  return {
    id: userId,
    email: user?.email ?? null,
    name: user?.name ?? null,
    tier: effectivePlanTier(sub),
    periodStart: sub?.currentPeriodStart ?? null,
  };
}

export async function localPlanTier(userId: string): Promise<GenerationTier> {
  const sub = await db.subscription.findUnique({ where: { userId } });
  return effectivePlanTier(sub);
}

export async function chargeScreenedGeneration(input: {
  userId: string;
  gate: ModerationGate;
  imageCount: number;
  reference: string;
  idempotencyKey: string;
  api?: CreditsApi;
  now?: number;
}): Promise<ChargeResult> {
  const user = await loadCreditUser(input.userId);
  if (user.tier === "ENTERPRISE") {
    console.warn(
      "ENTERPRISE generation has no monthly credit allotment; debiting actual usage from the generation wallet if it has a balance.",
    );
  }
  let api: CreditsApi;
  try {
    api = input.api ?? createSdkCreditsApi();
  } catch {
    return {
      ok: false,
      error: "credits_unavailable",
      tier: user.tier,
      allotmentConfigured: user.tier !== "ENTERPRISE",
    };
  }
  return applyGenerationCharge(api, {
    user,
    gate: input.gate,
    imageCount: input.imageCount,
    reference: input.reference,
    idempotencyKey: input.idempotencyKey,
    now: input.now,
  });
}

export async function refundGenerationDebit(hold: {
  accountId: string;
  transactionId: string;
}): Promise<{ reversed: boolean }> {
  try {
    const api = createSdkCreditsApi();
    const result = await reverseDebit(api, hold);
    if (!result.reversed) {
      console.error("Creem debit reversal failed", { transactionId: hold.transactionId });
    }
    return result;
  } catch {
    console.error("Creem debit reversal failed", { transactionId: hold.transactionId });
    return { reversed: false };
  }
}

export async function readGenerationQuota(userId: string): Promise<QuotaView> {
  const sub = await db.subscription.findUnique({ where: { userId } });
  const tier = effectivePlanTier(sub);
  if (!process.env.CREEM_API_KEY?.trim()) return unavailableQuota(tier);

  try {
    const user = await loadCreditUser(userId);
    const api = createSdkCreditsApi();
    const customerId = await findOrCreateCustomer(api, user);
    const accountId = await findOrCreateGenerationWallet(api, customerId);
    await ensureMonthlyGrant(api, accountId, user);
    const balance = parseCreditBalance(await api.getBalance(accountId));
    if (balance === null) return unavailableQuota(tier);
    return toQuotaView({ tier, balance });
  } catch {
    return unavailableQuota(tier);
  }
}

export type { DebitHold, GenerationTier };
