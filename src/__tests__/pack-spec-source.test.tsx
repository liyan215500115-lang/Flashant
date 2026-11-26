import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import zh from "../../messages/zh.json";
import { I18nProvider } from "@/components/i18n-provider";
import { StudioDetailPanel } from "@/components/studio/detail-panel";

const INFO_SHOTS = ["selling_points", "material", "size", "craft", "compare"];
const BOILERPLATE = "Product in clean style";

type ShotRequest = { key: string; prompt: string; specText?: string };
type GenerateBody = {
  detailTypes: ShotRequest[];
  baseStyle?: string;
};

describe("info-shot spec copy", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/generate")) {
        return new Response(JSON.stringify({ generated: [], failed: [], requested: 1, completed: 0 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function render(node: ReactNode) {
    await act(async () => {
      root?.render(node);
    });
  }

  function panel(basePrompt: string, projectId = "proj-spec") {
    return (
      <I18nProvider locale="zh" messages={zh}>
        <StudioDetailPanel projectId={projectId} productImageId="img-1" basePrompt={basePrompt} />
      </I18nProvider>
    );
  }

  async function openPack() {
    const button = [...(container?.querySelectorAll("button") ?? [])].find((item) =>
      item.textContent?.includes("详情图"),
    );
    if (!button) throw new Error("pack panel toggle not found");
    await act(async () => {
      button.click();
    });
  }

  async function clickType(label: string) {
    const button = [...(container?.querySelectorAll("button") ?? [])].find((item) => {
      const text = item.textContent?.trim() ?? "";
      return text === label || text.startsWith(`${label} ·`);
    });
    if (!button) throw new Error(`type button not found: ${label}`);
    await act(async () => {
      button.click();
    });
  }

  async function selectSpecGroup() {
    const header = [...(container?.querySelectorAll("button") ?? [])].find((item) =>
      item.textContent?.includes("规格组") && item.querySelector("button"),
    );
    const selectAll = [...(header?.querySelectorAll("button") ?? [])].find((item) =>
      item.textContent?.trim() === "全选",
    );
    if (!selectAll) throw new Error("spec group select-all not found");
    await act(async () => {
      selectAll.click();
    });
  }

  async function showNotes() {
    const button = [...(container?.querySelectorAll("button") ?? [])].find((item) =>
      item.textContent?.includes("自定义每张图的描述"),
    );
    if (!button) throw new Error("custom description toggle not found");
    await act(async () => {
      button.click();
    });
  }

  function noteInput(label: string): HTMLInputElement {
    const span = [...(container?.querySelectorAll("span") ?? [])].find((item) => item.textContent?.trim() === label);
    const input = span?.parentElement?.querySelector("input");
    if (!(input instanceof HTMLInputElement)) throw new Error(`note input not found: ${label}`);
    return input;
  }

  function typeInto(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  async function generate(): Promise<GenerateBody> {
    const button = [...(container?.querySelectorAll("button") ?? [])].find((item) =>
      item.textContent?.startsWith("生成 ") && item.textContent?.includes("张套图"),
    );
    if (!button) throw new Error("generate button not found");
    await act(async () => {
      button.click();
    });
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const call = fetchMock.mock.calls.find((item) => String(item[0]).includes("/api/generate"));
    const init = call?.[1] as RequestInit | undefined;
    return JSON.parse(String(init?.body)) as GenerateBody;
  }

  it("does not put an empty left prompt or style boilerplate into selling-point spec text", async () => {
    await render(panel(BOILERPLATE));
    await openPack();
    await clickType("核心卖点");
    await clickType("核心卖点");
    await selectSpecGroup();
    await clickType("使用场景");
    await clickType("使用场景");
    await showNotes();

    await clickType("场景氛围");
    await clickType("使用中");

    expect(noteInput("核心卖点").value).toBe("");
    expect(noteInput("材质成分").value).toBe("");
    expect(noteInput("使用场景").value).toBe("");
    expect(noteInput("场景氛围").value).toBe("");
    expect(noteInput("使用中").value).toBe("");
    expect(noteInput("使用场景").placeholder).toBe("AI 视觉描述（不写字）");
    expect(noteInput("核心卖点").placeholder).toBe("规格文字（写在图上）");
    expect(container?.textContent).toContain("规格文字留空则不往图上写字");
    expect(container?.textContent).toContain("AI 视觉描述（不写字）");
    expect(container?.textContent).toContain("规格文字（写在图上）");

    const lock = container?.querySelector('input[type="checkbox"]');
    if (!(lock instanceof HTMLInputElement)) throw new Error("style lock missing");
    await act(async () => {
      lock.click();
    });

    const body = await generate();
    const selling = body.detailTypes.find((shot) => shot.key === "selling_points");
    expect(selling?.specText).toBeUndefined();
    expect(selling?.prompt ?? "").not.toContain(BOILERPLATE);
    for (const shot of body.detailTypes) {
      if (INFO_SHOTS.includes(shot.key)) {
        expect(shot.specText).toBeUndefined();
        expect(shot.prompt).not.toContain(BOILERPLATE);
      }
    }
    const lifestyle = body.detailTypes.find((shot) => shot.key === "lifestyle");
    expect(lifestyle?.prompt).toContain(BOILERPLATE);
    expect(lifestyle?.specText).toBeUndefined();
    expect(body.baseStyle).toBe(BOILERPLATE);
    expect(JSON.stringify(body.detailTypes)).not.toContain('"specText":"Product in clean style"');
  });

  it("does not copy a real left-side prompt into info-shot spec text", async () => {
    await render(panel("蓝牙降噪"));
    await openPack();
    await clickType("核心卖点");
    await clickType("核心卖点");
    await showNotes();
    expect(noteInput("核心卖点").value).toBe("");
    await clickType("场景氛围");
    expect(noteInput("场景氛围").value).toBe("蓝牙降噪");

    const lock = container?.querySelector('input[type="checkbox"]');
    if (!(lock instanceof HTMLInputElement)) throw new Error("style lock missing");
    await act(async () => {
      lock.click();
    });

    const body = await generate();
    const selling = body.detailTypes.find((shot) => shot.key === "selling_points");
    expect(selling?.specText).toBeUndefined();
    expect(selling?.prompt ?? "").not.toContain("蓝牙降噪");
    const lifestyle = body.detailTypes.find((shot) => shot.key === "lifestyle");
    expect(lifestyle?.prompt).toContain("蓝牙降噪");
    expect(lifestyle?.specText).toBeUndefined();
    expect(body.baseStyle).toBe("蓝牙降噪");
  });

  it("still sends spec text the user typed, including when it matches the left prompt", async () => {
    await render(panel(BOILERPLATE));
    await openPack();
    await showNotes();
    await act(async () => {
      typeInto(noteInput("核心卖点"), "温和保湿");
    });
    await selectSpecGroup();
    expect(noteInput("核心卖点").value).toBe("温和保湿");
    expect(noteInput("材质成分").value).toBe("");

    const body = await generate();
    const selling = body.detailTypes.find((shot) => shot.key === "selling_points");
    expect(selling).toMatchObject({ key: "selling_points", prompt: "", specText: "温和保湿" });
    for (const shot of body.detailTypes) {
      if (shot.key !== "selling_points" && INFO_SHOTS.includes(shot.key)) {
        expect(shot.specText).toBeUndefined();
      }
    }
    expect(body.detailTypes.find((shot) => shot.key === "lifestyle")?.prompt).toContain(BOILERPLATE);
    expect(body.baseStyle).toBeUndefined();
  });

  it("drops a saved style-boilerplate spec note and keeps an explicit one", async () => {
    localStorage.setItem("flashant.studioPack.v1:proj-draft", JSON.stringify({
      selected: ["selling_points", "material", "lifestyle", "scene_atmosphere", "in_use", "detail"],
      category: "",
      lockStyle: true,
      perTypeDesc: {
        selling_points: BOILERPLATE,
        material: "温和保湿",
        lifestyle: BOILERPLATE,
        scene_atmosphere: "  Product in natural style.  ",
        in_use: "手持在窗边",
        detail: "金扣微距",
      },
      open: true,
    }));
    await render(panel(BOILERPLATE, "proj-draft"));
    await showNotes();
    expect(noteInput("核心卖点").value).toBe("");
    expect(noteInput("材质成分").value).toBe("温和保湿");
    expect(noteInput("使用场景").value).toBe("");
    expect(noteInput("场景氛围").value).toBe("");
    expect(noteInput("使用中").value).toBe("手持在窗边");
    expect(noteInput("细节特写").value).toBe("金扣微距");

    await act(async () => {
      typeInto(noteInput("使用场景"), "浴室晨光");
      typeInto(noteInput("核心卖点"), "温和保湿");
    });
    expect(noteInput("使用场景").value).toBe("浴室晨光");
    expect(noteInput("核心卖点").value).toBe("温和保湿");
    expect(container?.textContent).toContain("AI 视觉描述（不写字）");
    expect(container?.textContent).toContain("规格文字（写在图上）");
    expect(container?.textContent).toContain("规格文字留空则不往图上写字");
    expect(noteInput("细节特写").placeholder).toBe("AI 视觉描述（不写字）");
    expect(noteInput("材质成分").placeholder).toBe("规格文字（写在图上）");

    const body = await generate();
    expect(body.detailTypes.find((shot) => shot.key === "selling_points")).toMatchObject({
      prompt: "",
      specText: "温和保湿",
    });
    expect(body.detailTypes.find((shot) => shot.key === "material")).toMatchObject({
      prompt: "",
      specText: "温和保湿",
    });
    expect(body.detailTypes.find((shot) => shot.key === "lifestyle")?.prompt).toContain("浴室晨光");
    expect(body.detailTypes.find((shot) => shot.key === "lifestyle")?.prompt).toContain(BOILERPLATE);
    expect(body.detailTypes.find((shot) => shot.key === "in_use")?.prompt).toContain("手持在窗边");
    expect(body.detailTypes.find((shot) => shot.key === "scene_atmosphere")?.prompt).not.toContain("Product in natural style");
    expect(body.baseStyle).toBe(BOILERPLATE);
  });
});
