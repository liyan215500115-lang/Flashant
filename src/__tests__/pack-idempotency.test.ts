import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluatePackLock } from "@/lib/generate/pack-run";
import { PACK_RUN_LOCK_MS } from "@/lib/generate/pack-timing";

const { getProviderMock, createPrediction, getPrediction, chargeMock } = vi.hoisted(() => {
  const createPrediction = vi.fn();
  const getPrediction = vi.fn();
  const chargeMock = vi.fn();
  return {
    createPrediction,
    getPrediction,
    chargeMock,
    getProviderMock: vi.fn(() => ({ createPrediction, getPrediction })),
  };
});

const row = {
  id: "proj_1",
  userId: "user_1",
  activePackKey: null as string | null,
  activePackStartedAt: null as Date | null,
  activePackSettled: false,
};

vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { id: "user_1" } })) }));
vi.mock("@/lib/db", () => ({
  db: {
    imageProject: {
      findUnique: vi.fn(async () => ({ ...row })),
      update: vi.fn(async ({ data }: { data: Partial<typeof row> }) => {
        Object.assign(row, data);
        return { ...row };
      }),
      updateMany: vi.fn(async ({ where, data }: {
        where: { id: string; userId: string; activePackKey: string | null; activePackSettled: boolean };
        data: { activePackKey: string; activePackStartedAt: Date; activePackSettled: boolean };
      }) => {
        const currentKey = row.activePackKey ?? null;
        if (where.id !== row.id || where.userId !== row.userId) return { count: 0 };
        if (where.activePackKey !== currentKey) return { count: 0 };
        if (where.activePackSettled !== (row.activePackSettled === true)) return { count: 0 };
        row.activePackKey = data.activePackKey;
        row.activePackStartedAt = data.activePackStartedAt;
        row.activePackSettled = data.activePackSettled;
        return { count: 1 };
      }),
    },
    task: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "task_1" })),
      update: vi.fn(async () => ({})),
      count: vi.fn(async () => 0),
    },
    productImage: {
      findUnique: vi.fn(async () => ({
        id: "img_1",
        s3Key: null,
        originalUrl: "https://cdn.example/product.jpg",
      })),
    },
    generatedImage: {
      create: vi.fn(async () => ({ id: `gen_${row.activePackKey}` })),
      update: vi.fn(async () => ({})),
    },
  },
}));
vi.mock("@/lib/creem/credits-runtime", () => ({
  chargeScreenedGeneration: chargeMock,
  refundGenerationDebit: vi.fn(async () => ({ reversed: true })),
  localPlanTier: vi.fn(async () => "FREE"),
}));
vi.mock("@/lib/ai/registry", () => ({ getProvider: getProviderMock }));
vi.mock("@/lib/s3", () => ({
  getSignedGetUrl: vi.fn(async () => "https://cdn.example/signed.jpg"),
  uploadBuffer: vi.fn(),
  hasS3Config: () => false,
}));
vi.mock("@/lib/reference-image", () => ({
  prepareReferenceImage: vi.fn(async (url: string) => url),
}));
vi.mock("@/lib/overlay-logo", () => ({
  overlayLogo: vi.fn(),
  fetchImageBuffer: vi.fn(),
}));
vi.mock("@/lib/server-t", () => ({ serverT: vi.fn(async (key: string) => key) }));

import { POST as generatePost } from "@/app/api/generate/route";
import { db } from "@/lib/db";

function post(key: string) {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      imageProjectId: "proj_1",
      productImageId: "img_1",
      category: "fashion",
      packIdempotencyKey: key,
      detailTypes: [{ key: "in_use", prompt: "gold earrings worn" }],
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  row.activePackKey = null;
  row.activePackStartedAt = null;
  row.activePackSettled = false;
  vi.stubEnv("CREEM_MODERATION", "enforce");
  vi.stubEnv("CREEM_API_KEY", "creem_test_unit");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    decision: "allow",
    id: "mod_unit",
    object: "moderation_result",
  }), { status: 200, headers: { "content-type": "application/json" } })));
  chargeMock.mockResolvedValue({
    ok: true,
    tier: "PRO",
    balance: 90,
    allotmentConfigured: true,
    hold: {
      accountId: "cca_unit",
      transactionId: "cct_unit",
      amount: 1,
      moderationId: "mod_unit",
      reference: "gen:unit",
      idempotencyKey: "debit:unit",
    },
  });
  createPrediction.mockResolvedValue({
    predictionId: "pred_1",
    status: "succeeded",
    outputs: [{ url: "https://cdn.example/out.png" }],
  });
  getPrediction.mockResolvedValue({ status: "processing", outputs: [] });
});

describe("pack click idempotency", () => {
  it("joins the same key instead of debiting a second pack", async () => {
    const first = await generatePost(post("click_same_01"));
    expect(first.status).toBe(200);
    expect(chargeMock).toHaveBeenCalledTimes(1);
    expect(createPrediction).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.generatedImage.create)).toHaveBeenCalledTimes(1);
    expect(row.activePackKey).toBe("click_same_01");
    expect(row.activePackSettled).toBe(true);

    const second = await generatePost(post("click_same_01"));
    expect(second.status).toBe(202);
    const body = await second.json();
    expect(body.status).toBe("pack_in_progress");
    expect(body.poll).toBe(true);
    expect(chargeMock).toHaveBeenCalledTimes(1);
    expect(createPrediction).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.generatedImage.create)).toHaveBeenCalledTimes(1);
  });

  it("does not start a second pack while another click is still running", async () => {
    row.activePackKey = "click_running";
    row.activePackStartedAt = new Date();
    row.activePackSettled = false;

    const res = await generatePost(post("click_other_02"));
    expect(res.status).toBe(202);
    expect(chargeMock).not.toHaveBeenCalled();
    expect(createPrediction).not.toHaveBeenCalled();
    expect(vi.mocked(db.generatedImage.create)).not.toHaveBeenCalled();
    expect(row.activePackKey).toBe("click_running");
  });

  it("allows a new click after the previous pack has settled", async () => {
    const first = await generatePost(post("click_done_01"));
    expect(first.status).toBe(200);
    const second = await generatePost(post("click_done_02"));
    expect(second.status).toBe(200);
    expect(chargeMock).toHaveBeenCalledTimes(2);
    expect(createPrediction).toHaveBeenCalledTimes(2);
    const keys = chargeMock.mock.calls.map((call) => call[0].idempotencyKey as string);
    expect(keys[0]).toContain("click_done_01");
    expect(keys[1]).toContain("click_done_02");
    expect(new Set(keys).size).toBe(2);
  });
});

describe("evaluatePackLock", () => {
  const now = 1_000_000;

  it("keeps one click on a single pack", () => {
    expect(evaluatePackLock({}, "click_aaaa", now)).toBe("start");
    expect(evaluatePackLock({
      activePackKey: "click_aaaa",
      activePackStartedAt: new Date(now),
      activePackSettled: false,
    }, "click_aaaa", now)).toBe("join");
    expect(evaluatePackLock({
      activePackKey: "click_aaaa",
      activePackStartedAt: new Date(now),
      activePackSettled: true,
    }, "click_aaaa", now + PACK_RUN_LOCK_MS + 1)).toBe("join");
    expect(evaluatePackLock({
      activePackKey: "click_aaaa",
      activePackStartedAt: new Date(now),
      activePackSettled: false,
    }, "click_bbbb", now + 1_000)).toBe("join");
    expect(evaluatePackLock({
      activePackKey: "click_aaaa",
      activePackStartedAt: new Date(now),
      activePackSettled: true,
    }, "click_bbbb", now + 1_000)).toBe("start");
    expect(evaluatePackLock({
      activePackKey: "click_aaaa",
      activePackStartedAt: new Date(now - PACK_RUN_LOCK_MS - 1),
      activePackSettled: false,
    }, "click_bbbb", now)).toBe("start");
  });
});
