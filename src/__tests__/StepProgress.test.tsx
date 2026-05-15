import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StepProgress } from "@/components/pipeline/StepProgress";

describe("StepProgress", () => {
  it("renders 9 stage labels", () => {
    render(<StepProgress status="PARSING" />);
    expect(screen.getByText("解析")).toBeDefined();
    expect(screen.getByText("脚本")).toBeDefined();
    expect(screen.getByText("图片")).toBeDefined();
    expect(screen.getByText("视频")).toBeDefined();
    expect(screen.getByText("配音")).toBeDefined();
    expect(screen.getByText("审核")).toBeDefined();
    expect(screen.getByText("通过")).toBeDefined();
    expect(screen.getByText("发布")).toBeDefined();
    expect(screen.getByText("完成")).toBeDefined();
  });

  it("shows failed state when status is FAILED", () => {
    render(<StepProgress status="FAILED" />);
    expect(screen.getByText(/失败/)).toBeDefined();
  });
});
