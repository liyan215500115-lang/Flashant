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
});
