import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "user_free" } })),
}));

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    subscription: { findUnique: vi.fn() },
    generatedImage: { count: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { proxy } from "@/proxy";

describe("generation quota gateway", () => {
  it("does not 402 /api/generate when the UI policy is unlimited", async () => {
    dbMock.subscription.findUnique.mockResolvedValue(null);
    dbMock.generatedImage.count.mockResolvedValue(11);

    const response = await proxy(
      new NextRequest(new URL("/api/generate", "https://flashant.cn"), { method: "POST" })
    );

    expect(response.status).not.toBe(402);
    expect(dbMock.generatedImage.count).not.toHaveBeenCalled();
    expect(dbMock.subscription.findUnique).not.toHaveBeenCalled();
  });
});
