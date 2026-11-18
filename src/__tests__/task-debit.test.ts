import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, dbMock, refundMock, createPrediction } = vi.hoisted(() => ({
  authMock: vi.fn(),
  refundMock: vi.fn(async () => ({ reversed: true })),
  createPrediction: vi.fn(),
  dbMock: {
    task: { findUnique: vi.fn(), update: vi.fn(), count: vi.fn(async () => 0) },
    imageProject: { findUnique: vi.fn(), update: vi.fn() },
    generatedImage: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));
vi.mock("@/lib/creem/credits-runtime", () => ({ refundGenerationDebit: refundMock }));
vi.mock("@/lib/ai/registry", () => ({
  getProvider: () => ({ createPrediction, getPrediction: vi.fn() }),
}));
vi.mock("@/lib/s3", () => ({
  uploadBuffer: vi.fn(),
  hasS3Config: () => false,
}));
vi.mock("@/lib/overlay-logo", () => ({
  fetchImageBuffer: vi.fn(),
}));

import { GET } from "@/app/api/tasks/[id]/route";
import { reverseStoredTaskDebit } from "@/lib/creem/task-debit";

const debit = { accountId: "cca_stored", transactionId: "cct_stored" };
const generationMeta = { creemDebit: debit };

function poll() {
  return GET(new Request("http://localhost/api/tasks/task_1"), {
    params: Promise.resolve({ id: "task_1" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "user_1" } });
  refundMock.mockResolvedValue({ reversed: true });
  dbMock.task.update.mockResolvedValue({});
  dbMock.task.count.mockResolvedValue(0);
  dbMock.imageProject.findUnique.mockResolvedValue({ status: "DRAFT" });
  dbMock.generatedImage.findFirst.mockResolvedValue(null);
});

describe("durable task debit handle", () => {
  it("keeps generationMeta when the first poll moves the task to PROCESSING", async () => {
    dbMock.task.findUnique.mockImplementation(async (args: { select?: { generationMeta?: boolean; id?: boolean } }) => {
      if (args.select?.generationMeta) {
        return { generationMeta };
      }
      if (args.select?.id) {
        return {
          id: "task_1",
          status: "FAILED",
          predictionId: null,
          errorMessage: "model timed out",
          engineType: "gemini",
          resultUrl: null,
          createdAt: new Date(),
        };
      }
      return {
        id: "task_1",
        status: "PENDING",
        engineType: "gemini",
        imageProjectId: "proj_1",
        productImageId: "img_1",
        errorMessage: JSON.stringify({ prompt: "a red mug", sharedImageUrl: "https://cdn.example/p.jpg" }),
        generationMeta,
        project: { userId: "user_1" },
        promptTemplate: null,
        predictionId: null,
        resultUrl: null,
        createdAt: new Date(),
      };
    });
    createPrediction.mockRejectedValue(new Error("model timed out"));

    const res = await poll();
    expect(res.status).toBe(200);

    const processingUpdate = dbMock.task.update.mock.calls.find(
      (call) => call[0].data?.status === "PROCESSING",
    );
    expect(processingUpdate?.[0].data).toEqual({ status: "PROCESSING", errorMessage: null });
    expect(processingUpdate?.[0].data.generationMeta).toBeUndefined();
    expect(refundMock).toHaveBeenCalledWith(debit);
  });

  it("reverses from generationMeta when errorMessage is null and the original request is gone", async () => {
    dbMock.task.findUnique.mockResolvedValue({ generationMeta });

    const result = await reverseStoredTaskDebit("task_1");

    expect(dbMock.task.findUnique).toHaveBeenCalledWith({
      where: { id: "task_1" },
      select: { generationMeta: true },
    });
    expect(refundMock).toHaveBeenCalledWith(debit);
    expect(result).toEqual({ reversed: true });
  });
});
