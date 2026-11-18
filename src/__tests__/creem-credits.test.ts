import { describe, expect, it, vi } from "vitest";
import {
  applyGenerationCharge,
  creemSdkServerForBaseUrl,
  effectivePlanTier,
  ensureMonthlyGrant,
  GENERATION_ALLOTMENT,
  monthlyGrantKey,
  shouldReverseSharedDebit,
  toQuotaView,
  withGenerationDebit,
  type CreditsApi,
  type CreditUser,
} from "@/lib/creem/credits";
import { creemApiBaseUrl, type ModerationGate } from "@/lib/creem/moderation";

const NOW = Date.parse("2026-11-18T00:00:00.000Z");

function user(overrides: Partial<CreditUser> = {}): CreditUser {
  return {
    id: "user_1",
    email: "ada@example.com",
    name: "Ada",
    tier: "FREE",
    periodStart: null,
    ...overrides,
  };
}

function allowGate(ageMs = 0): ModerationGate {
  return {
    allowed: true,
    decision: "allow",
    moderationId: "mod_allow_1",
    screenedAt: NOW - ageMs,
  };
}

function apiFixture(options?: { balance?: string; creditConflict?: boolean }) {
  let balance = options?.balance ?? "0";
  const accounts: Array<{ id: string; name: string; status: string }> = [];
  let customer: { id: string; externalId?: string | null } | null = null;
  const credit = vi.fn(async (_accountId: string, input: { amount: string; idempotencyKey: string }) => {
    if (options?.creditConflict) {
      throw { statusCode: 409, message: "Idempotency key already used", error: { code: "idempotency_conflict" } };
    }
    balance = String(Number(balance) + Number(input.amount));
    return { id: `cct_${input.idempotencyKey}` };
  });
  const debit = vi.fn(async (_accountId: string, input: { amount: string }) => {
    balance = String(Number(balance) - Number(input.amount));
    return { id: "cct_debit_1" };
  });
  const reverse = vi.fn(async () => ({ id: "cct_reverse_1" }));
  const createCustomer = vi.fn(async (input: { externalId: string }) => {
    customer = { id: "cust_1", externalId: input.externalId };
    return customer;
  });
  const createGenerationAccount = vi.fn(async () => {
    const account = { id: "cca_generation", name: "generation", status: "active" };
    accounts.push(account);
    return account;
  });
  const credits: CreditsApi = {
    retrieveCustomerByEmail: vi.fn(async () => customer),
    createCustomer,
    updateCustomerExternalId: vi.fn(async () => undefined),
    listAccounts: vi.fn(async () => accounts.slice()),
    createGenerationAccount,
    getBalance: vi.fn(async () => balance),
    credit,
    debit,
    reverse,
  };
  return { credits, credit, debit, reverse, createCustomer, createGenerationAccount, readBalance: () => balance };
}

describe("Creem SDK host", () => {
  it("uses the same test or live host as moderation", () => {
    expect(creemSdkServerForBaseUrl(creemApiBaseUrl({ CREEM_API_KEY: "creem_test_abc" }))).toBe("test");
    expect(creemSdkServerForBaseUrl(creemApiBaseUrl({ CREEM_API_KEY: "creem_live_example" }))).toBe("prod");
    expect(
      creemSdkServerForBaseUrl(creemApiBaseUrl({ CREEM_API_KEY: "creem_test_abc", CREEM_TEST_MODE: "false" })),
    ).toBe("prod");
  });
});

describe("monthly generation grant", () => {
  const accountId = "cca_generation";

  it("grants the shortfall once per user and period", async () => {
    const { credits, credit } = apiFixture({ balance: "0" });
    const free = user();
    const first = await ensureMonthlyGrant(credits, accountId, free, new Date(NOW));
    const second = await ensureMonthlyGrant(credits, accountId, free, new Date(NOW));
    expect(first).toMatchObject({ granted: true, amount: "10" });
    expect(second.reason).toBe("at_or_above_allotment");
    expect(credit).toHaveBeenCalledTimes(1);
    expect(credit.mock.calls[0][1]).toEqual({
      amount: "10",
      reference: monthlyGrantKey(free, new Date(NOW)),
      idempotencyKey: monthlyGrantKey(free, new Date(NOW)),
    });
  });

  it("treats an idempotency conflict as the same grant", async () => {
    const { credits, credit } = apiFixture({ balance: "4", creditConflict: true });
    const result = await ensureMonthlyGrant(credits, accountId, user(), new Date(NOW));
    expect(result.reason).toBe("already_granted");
    expect(credit).toHaveBeenCalledTimes(1);
    expect(credit.mock.calls[0][1].amount).toBe("6");
    expect(credit.mock.calls[0][1].idempotencyKey).toBe(credit.mock.calls[0][1].reference);
  });

  it("tops up to the allotment instead of stacking a full grant", async () => {
    const { credits, credit } = apiFixture({ balance: "7" });
    const nextMonth = new Date("2026-12-02T00:00:00.000Z");
    const result = await ensureMonthlyGrant(credits, accountId, user(), nextMonth);
    expect(result.amount).toBe("3");
    expect(credit.mock.calls[0][1].idempotencyKey).toContain("month:2026-12");
  });

  it("does not credit a paid tier again when the wallet is already at the allotment", async () => {
    const { credits, credit } = apiFixture({ balance: "100" });
    const pro = user({
      tier: "PRO",
      periodStart: new Date("2026-11-01T00:00:00.000Z"),
    });
    const result = await ensureMonthlyGrant(credits, accountId, pro, new Date(NOW));
    expect(result.reason).toBe("at_or_above_allotment");
    expect(credit).not.toHaveBeenCalled();
    expect(monthlyGrantKey(pro, new Date(NOW))).toBe("grant:user_1:PRO:period:2026-11-01T00:00:00.000Z");
  });

  it("does not grant Pro or Business when the paid-tier flag is off, and still grants Free", async () => {
    const pro = apiFixture({ balance: "0" });
    const proResult = await ensureMonthlyGrant(
      pro.credits,
      accountId,
      user({ tier: "PRO", periodStart: new Date("2026-11-01T00:00:00.000Z") }),
      new Date(NOW),
      false,
    );
    expect(proResult.reason).toBe("paid_grant_disabled");
    expect(pro.credit).not.toHaveBeenCalled();

    const business = apiFixture({ balance: "20" });
    const businessResult = await ensureMonthlyGrant(
      business.credits,
      accountId,
      user({ tier: "BUSINESS", periodStart: new Date("2026-11-01T00:00:00.000Z") }),
      new Date(NOW),
      false,
    );
    expect(businessResult.reason).toBe("paid_grant_disabled");
    expect(business.credit).not.toHaveBeenCalled();

    const free = apiFixture({ balance: "0" });
    const freeResult = await ensureMonthlyGrant(free.credits, accountId, user({ tier: "FREE" }), new Date(NOW), false);
    expect(freeResult).toMatchObject({ granted: true, amount: "10" });
    expect(free.credit).toHaveBeenCalledTimes(1);
  });

  it("does not invent an enterprise allotment", async () => {
    const { credits, credit } = apiFixture({ balance: "0" });
    const result = await ensureMonthlyGrant(credits, accountId, user({ tier: "ENTERPRISE" }), new Date(NOW));
    expect(result.reason).toBe("enterprise_allotment_unconfigured");
    expect(credit).not.toHaveBeenCalled();
    expect(GENERATION_ALLOTMENT.ENTERPRISE).toBe(-1);
  });
});

describe("generation debit", () => {
  it("sends moderation_id, amount, reference, and one idempotency key", async () => {
    const { credits, debit, createCustomer, createGenerationAccount } = apiFixture({ balance: "10" });
    const result = await applyGenerationCharge(credits, {
      user: user(),
      gate: allowGate(),
      imageCount: 1,
      reference: "gen:one",
      idempotencyKey: "debit:one",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    expect(createCustomer).toHaveBeenCalledWith({
      email: "ada@example.com",
      name: "Ada",
      externalId: "user_1",
    });
    expect(createGenerationAccount).toHaveBeenCalledTimes(1);
    expect(debit).toHaveBeenCalledTimes(1);
    expect(debit.mock.calls[0][1]).toEqual({
      amount: "1",
      reference: "gen:one",
      idempotencyKey: "debit:one",
      moderationId: "mod_allow_1",
    });
  });

  it("debits N images from one prompt in a single call", async () => {
    const { credits, debit } = apiFixture({ balance: "100" });
    const result = await applyGenerationCharge(credits, {
      user: user({ tier: "PRO" }),
      gate: allowGate(),
      imageCount: 4,
      reference: "gen:four",
      idempotencyKey: "debit:four",
      now: NOW,
    });
    expect(result.ok).toBe(true);
    expect(debit).toHaveBeenCalledTimes(1);
    expect(debit.mock.calls[0][1].amount).toBe("4");
    expect(debit.mock.calls[0][1].moderationId).toBe("mod_allow_1");
  });

  it("does not debit when the balance is too low", async () => {
    const { credits, debit } = apiFixture({ balance: "0" });
    const result = await applyGenerationCharge(credits, {
      user: user({ tier: "ENTERPRISE" }),
      gate: allowGate(),
      imageCount: 1,
      reference: "gen:empty",
      idempotencyKey: "debit:empty",
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("insufficient_credits");
      expect(result.allotmentConfigured).toBe(false);
    }
    expect(debit).not.toHaveBeenCalled();
  });

  it("does not debit a stale or non-allow moderation result", async () => {
    const { credits, debit } = apiFixture({ balance: "10" });
    const stale = await applyGenerationCharge(credits, {
      user: user(),
      gate: allowGate(25 * 60 * 60 * 1000),
      imageCount: 1,
      reference: "gen:stale",
      idempotencyKey: "debit:stale",
      now: NOW,
    });
    const flagged = await applyGenerationCharge(credits, {
      user: user(),
      gate: { allowed: false, decision: "flag" },
      imageCount: 1,
      reference: "gen:flag",
      idempotencyKey: "debit:flag",
      now: NOW,
    });
    expect(stale.ok).toBe(false);
    expect(flagged.ok).toBe(false);
    expect(debit).not.toHaveBeenCalled();
  });

  it("reverses the exact debit when generation fails and does not claim a failed reversal", async () => {
    const { credits, debit, reverse } = apiFixture({ balance: "10" });
    const failed = await withGenerationDebit(
      credits,
      {
        user: user(),
        gate: allowGate(),
        imageCount: 2,
        reference: "gen:fail",
        idempotencyKey: "debit:fail",
        now: NOW,
      },
      async () => {
        throw new Error("model down");
      },
    );
    expect(debit).toHaveBeenCalledTimes(1);
    expect(debit.mock.calls[0][1].amount).toBe("2");
    expect(reverse).toHaveBeenCalledWith("cca_generation", "cct_debit_1");
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.reversed).toBe(true);

    reverse.mockRejectedValueOnce(new Error("reverse down"));
    const unrefunded = await withGenerationDebit(
      credits,
      {
        user: user(),
        gate: allowGate(),
        imageCount: 1,
        reference: "gen:norefund",
        idempotencyKey: "debit:norefund",
        now: NOW,
      },
      async () => {
        throw new Error("model down");
      },
    );
    expect(unrefunded.ok).toBe(false);
    if (!unrefunded.ok) expect(unrefunded.reversed).toBe(false);
  });
});

describe("wallet quota view", () => {
  it("derives used and remaining from the wallet balance", () => {
    expect(toQuotaView({ tier: "PRO", balance: 40 })).toEqual({
      allowed: true,
      used: 60,
      limit: 100,
      tier: "PRO",
      balance: 40,
      allotmentConfigured: true,
    });
    expect(toQuotaView({ tier: "ENTERPRISE", balance: 12 }).allotmentConfigured).toBe(false);
    expect(toQuotaView({ tier: "ENTERPRISE", balance: 12 }).limit).toBe(12);
    expect(toQuotaView({ tier: "ENTERPRISE", balance: 0 }).allowed).toBe(false);
  });

  it("treats a canceled subscription as Free", () => {
    expect(effectivePlanTier({ planTier: "PRO", status: "CANCELED" })).toBe("FREE");
    expect(effectivePlanTier({ planTier: "BUSINESS", status: "ACTIVE" })).toBe("BUSINESS");
    expect(shouldReverseSharedDebit(["FAILED", "FAILED"])).toBe(true);
    expect(shouldReverseSharedDebit(["FAILED", "SUCCEEDED"])).toBe(false);
    expect(shouldReverseSharedDebit(["FAILED", "PROCESSING"])).toBe(false);
  });
});
