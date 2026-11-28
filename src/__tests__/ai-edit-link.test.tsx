import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AiEditLink, projectStudioHref } from "@/components/project/ai-edit-link";

describe("AI edit link", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
  });

  it("is the studio anchor, not a button wrapped by a link", () => {
    const projectId = "proj_lotion";
    expect(projectStudioHref(projectId)).toBe("/studio?projectId=proj_lotion");
    act(() => {
      root?.render(
        <AiEditLink projectId={projectId}>
          AI 编辑
        </AiEditLink>,
      );
    });
    const anchor = container?.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute("href")).toBe("/studio?projectId=proj_lotion");
    expect(anchor?.textContent).toContain("AI 编辑");
    expect(anchor?.querySelector("button")).toBeNull();
    expect(container?.querySelector("button")).toBeNull();
  });
});
