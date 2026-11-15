import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { StyleShowcase } from "@/components/landing/style-showcase";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const styles = [
  {
    key: "material",
    label: "Material · Watch",
    tooltip: "Same watch. Brushed steel.",
    images: [
      { src: "/watch-before.webp", alt: "watch source", caption: "Steel watch · Source" },
      { src: "/watch-after.webp", alt: "watch output", caption: "Steel watch · Output" },
    ],
  },
  {
    key: "lifestyle",
    label: "Lifestyle · Speaker",
    tooltip: "Same speaker. Leather cord.",
    images: [
      { src: "/speaker-before.webp", alt: "speaker source", caption: "Speaker · Source" },
      { src: "/speaker-after.webp", alt: "speaker output", caption: "Speaker · Output" },
    ],
  },
  {
    key: "scene",
    label: "Scene · Perfume",
    tooltip: "Same perfume bottle.",
    images: [
      { src: "/perfume-before.webp", alt: "perfume source", caption: "Perfume · Source" },
      { src: "/perfume-after.webp", alt: "perfume output", caption: "Perfume · Output" },
    ],
  },
];

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderShowcase() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <StyleShowcase title="Three looks" subtitle="Watch, speaker, and perfume." styles={styles} />
    );
  });
}

function buttons() {
  return [...document.querySelectorAll("button")];
}

afterEach(async () => {
  if (root) {
    const current = root;
    await act(async () => {
      current.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
});

describe("StyleShowcase tabs", () => {
  it("shows three white inactive pills and a brand active pill", async () => {
    await renderShowcase();
    const tabs = buttons();
    expect(tabs).toHaveLength(3);
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Material · Watch",
      "Lifestyle · Speaker",
      "Scene · Perfume",
    ]);

    for (const tab of tabs) {
      expect(tab.getAttribute("type")).toBe("button");
    }

    expect(tabs[0].getAttribute("aria-pressed")).toBe("true");
    expect(tabs[0].className).toContain("bg-brand-900");
    expect(tabs[1].getAttribute("aria-pressed")).toBe("false");
    expect(tabs[2].getAttribute("aria-pressed")).toBe("false");
    for (const tab of tabs.slice(1)) {
      expect(tab.className).toContain("bg-white");
      expect(tab.className).toContain("border-zinc-200");
      expect(tab.className).toContain("text-zinc-700");
      expect(tab.className).not.toContain("bg-zinc-50");
    }

    const images = [...document.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(images).toEqual(["/watch-before.webp", "/watch-after.webp"]);
  });

  it("switches to the speaker pair, then the perfume pair", async () => {
    await renderShowcase();
    const tabs = buttons();

    await act(async () => {
      tabs[1].click();
    });
    expect(buttons()[1].getAttribute("aria-pressed")).toBe("true");
    expect([...document.querySelectorAll("img")].map((img) => img.getAttribute("alt"))).toEqual([
      "speaker source",
      "speaker output",
    ]);

    await act(async () => {
      buttons()[2].click();
    });
    expect(buttons()[2].getAttribute("aria-pressed")).toBe("true");
    expect(buttons()[0].getAttribute("aria-pressed")).toBe("false");
    expect([...document.querySelectorAll("img")].map((img) => img.getAttribute("src"))).toEqual([
      "/perfume-before.webp",
      "/perfume-after.webp",
    ]);
    expect(document.querySelectorAll("img")).toHaveLength(2);
  });

  it("moves selection with the arrow keys", async () => {
    await renderShowcase();
    const first = buttons()[0];
    first.focus();

    await act(async () => {
      first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });

    const lifestyle = buttons()[1];
    expect(lifestyle.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(lifestyle);
    expect(document.querySelector("img")?.getAttribute("src")).toBe("/speaker-before.webp");
  });
});
