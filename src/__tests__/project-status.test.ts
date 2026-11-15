import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    task: { count: vi.fn() },
    imageProject: { findUnique: vi.fn(), update: vi.fn() },
    generatedImage: { count: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import { releaseGeneratingProject } from "@/lib/project-status";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("releaseGeneratingProject", () => {
  it("leaves an in-flight project on GENERATING", async () => {
    dbMock.task.count.mockResolvedValue(1);

    await releaseGeneratingProject("proj_1", "No output from provider");

    expect(dbMock.imageProject.update).not.toHaveBeenCalled();
  });

  it("does not rewrite a project that is already past GENERATING", async () => {
    dbMock.task.count.mockResolvedValue(0);
    dbMock.imageProject.findUnique.mockResolvedValue({ status: "DRAFT" });

    await releaseGeneratingProject("proj_1", "No output from provider");

    expect(dbMock.imageProject.update).not.toHaveBeenCalled();
  });

  it("marks FAILED when a task produced no output and nothing else is running", async () => {
    dbMock.task.count.mockResolvedValue(0);
    dbMock.imageProject.findUnique.mockResolvedValue({ status: "GENERATING" });
    dbMock.generatedImage.count.mockResolvedValue(0);

    await releaseGeneratingProject("proj_1", "No output from provider");

    expect(dbMock.imageProject.update).toHaveBeenCalledWith({
      where: { id: "proj_1" },
      data: { status: "FAILED", errorMessage: "No output from provider" },
    });
  });

  it("marks GENERATED when a failed task still leaves a successful image", async () => {
    dbMock.task.count.mockResolvedValue(0);
    dbMock.imageProject.findUnique.mockResolvedValue({ status: "GENERATING" });
    dbMock.generatedImage.count.mockResolvedValue(2);

    await releaseGeneratingProject("proj_1", "one variant failed");

    expect(dbMock.imageProject.update).toHaveBeenCalledWith({
      where: { id: "proj_1" },
      data: { status: "GENERATED", errorMessage: null },
    });
  });
});
