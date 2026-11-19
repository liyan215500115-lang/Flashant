import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock, refundMock } = vi.hoisted(() => ({
  refundMock: vi.fn(async () => ({ reversed: true })),
  dbMock: {
    generatedImage: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    task: { findFirst: vi.fn(), update: vi.fn() },
    imageProject: { update: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/creem/credits-runtime", () => ({ refundGenerationDebit: refundMock }));
vi.mock("@/lib/project-status", () => ({ releaseGeneratingProject: vi.fn(async () => undefined) }));
vi.mock("@/lib/s3", () => ({
  uploadBuffer: vi.fn(),
  saveBufferLocally: vi.fn(),
  hasS3Config: () => false,
}));
vi.mock("@/lib/ai/validator", () => ({ validateImage: vi.fn(() => ({ valid: true })) }));

import { POST } from "@/app/api/webhooks/replicate/route";

const debit = { accountId: "cca_1", transactionId: "cct_group" };

function image(id: string, status: string) {
  return { id, status, generationMeta: { creemDebit: debit } };
}

function webhook(body: unknown) {
  return new Request("http://localhost/api/webhooks/replicate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.generatedImage.findFirst.mockResolvedValue({
    id: "img_a",
    imageProjectId: "proj_1",
    project: { id: "proj_1" },
  });
  dbMock.generatedImage.update.mockResolvedValue({});
  dbMock.generatedImage.count.mockResolvedValue(0);
  dbMock.task.findFirst.mockResolvedValue({ id: "task_1" });
  dbMock.task.update.mockResolvedValue({});
  dbMock.imageProject.update.mockResolvedValue({});
  refundMock.mockResolvedValue({ reversed: true });
});

describe("Replicate webhook debit refund", () => {
  it("reverses the debit when a succeeded prediction has no outputs and every group member failed", async () => {
    dbMock.generatedImage.findMany.mockResolvedValue([
      image("img_a", "PROCESSING"),
      image("img_b", "FAILED"),
    ]);

    const res = await POST(webhook({ id: "pred_1", status: "succeeded", output: [] }));
    expect(res.status).toBe(200);
    expect(dbMock.generatedImage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "img_a" },
        data: expect.objectContaining({ status: "FAILED", errorMessage: "No outputs from Replicate" }),
      }),
    );
    expect(refundMock).toHaveBeenCalledTimes(1);
    expect(refundMock).toHaveBeenCalledWith(debit);
  });

  it("does not reverse when another image in the debit group succeeded", async () => {
    dbMock.generatedImage.findMany.mockResolvedValue([
      image("img_a", "PROCESSING"),
      image("img_b", "SUCCEEDED"),
    ]);

    await POST(webhook({ id: "pred_1", status: "succeeded", output: [] }));
    expect(refundMock).not.toHaveBeenCalled();
  });

  it("does not reverse when another image in the debit group is still in flight", async () => {
    dbMock.generatedImage.findMany.mockResolvedValue([
      image("img_a", "PROCESSING"),
      image("img_b", "PROCESSING"),
    ]);

    await POST(webhook({ id: "pred_1", status: "succeeded", output: [] }));
    expect(refundMock).not.toHaveBeenCalled();
  });
});
