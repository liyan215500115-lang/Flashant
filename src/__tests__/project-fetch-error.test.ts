import { describe, expect, it } from "vitest";
import { projectGenerationError } from "@/lib/project-fetch-error";

const label = "Generation failed, please retry";

describe("projectGenerationError", () => {
  it("clears the banner after FAILED is followed by GENERATED", () => {
    const failed = {
      status: "FAILED",
      errorMessage: "No output from provider",
      tasks: [{ status: "FAILED", errorMessage: "No output from provider" }],
    };
    expect(projectGenerationError(failed, label)).toBe(
      "Generation failed, please retry: No output from provider"
    );

    const generated = {
      status: "GENERATED",
      errorMessage: null,
      tasks: [{ status: "SUCCEEDED", errorMessage: null }],
    };
    expect(projectGenerationError(generated, label)).toBe("");
  });

  it("keeps a FAILED project error from task.errorMessage", () => {
    expect(
      projectGenerationError(
        {
          status: "FAILED",
          errorMessage: null,
          tasks: [{ status: "FAILED", errorMessage: "provider timeout" }],
        },
        label
      )
    ).toBe("Generation failed, please retry: provider timeout");
  });

  it("labels a stored not_started code for the project banner", () => {
    expect(
      projectGenerationError(
        {
          status: "FAILED",
          errorMessage: "not_started",
          tasks: [{ status: "FAILED", errorMessage: "not_started" }],
        },
        "生成失败",
        "zh",
      )
    ).toBe("生成失败: 未开始生成");
    expect(
      projectGenerationError(
        {
          status: "FAILED",
          errorMessage: "not_started",
        },
        "Generation failed",
        "en",
      )
    ).not.toContain("not_started");
  });

  it("hides raw 429, E005, and prediction_timeout text on the project banner", () => {
    const banner = projectGenerationError(
      {
        status: "FAILED",
        errorMessage: 'Replicate API error: 429 {"retry_after":1}',
        tasks: [{ status: "FAILED", errorMessage: "The input or output was flagged as sensitive. (E005) (abc)" }],
      },
      "生成失败",
      "zh",
    );
    expect(banner).not.toContain("429");
    expect(banner).not.toContain("{");
    expect(banner).toContain("繁忙");

    const timeout = projectGenerationError(
      {
        status: "FAILED",
        errorMessage: "prediction_timeout",
      },
      "Generation failed",
      "en",
    );
    expect(timeout).not.toContain("prediction_timeout");
    expect(timeout.toLowerCase()).toContain("timed out");
  });
});
