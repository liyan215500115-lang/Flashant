"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Sparkles } from "lucide-react";

interface StyleImage {
  src: string;
  alt: string;
  caption?: string;
}

interface StyleDef {
  key: string;
  label: string;
  tooltip: string;
  images: StyleImage[];
}

interface StyleShowcaseProps {
  title: string;
  subtitle: string;
  styles: StyleDef[];
}

function nextIndex(current: number, last: number, key: string): number | null {
  if (key === "ArrowRight" || key === "ArrowDown") {
    return current === last ? 0 : current + 1;
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return current === 0 ? last : current - 1;
  }
  if (key === "Home") return 0;
  if (key === "End") return last;
  return null;
}

export function StyleShowcase({ title, subtitle, styles }: StyleShowcaseProps) {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = styles[active];

  function select(index: number, focus = false) {
    setActive(index);
    if (focus) tabRefs.current[index]?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = styles.length - 1;
    if (last < 0) return;
    const next = nextIndex(index, last, event.key);
    if (next === null) return;
    event.preventDefault();
    select(next, true);
  }

  if (!current) return null;

  return (
    <section className="py-32 md:py-40 px-6 bg-zinc-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 animate-on-scroll">
          <h2 className="text-2xl md:text-3xl font-bold text-brand-900 tracking-tight">
            {title}
          </h2>
          <p className="mt-3 text-sm text-zinc-500 max-w-md mx-auto">
            {subtitle}
          </p>
        </div>

        <div
          role="group"
          aria-label={title}
          className="flex items-center justify-center gap-2 mb-10 flex-wrap"
        >
          {styles.map((s, i) => {
            const selected = i === active;
            return (
              <button
                key={s.key}
                ref={(node) => {
                  tabRefs.current[i] = node;
                }}
                id={`style-tab-${s.key}`}
                type="button"
                aria-pressed={selected}
                aria-controls={`style-panel-${s.key}`}
                title={s.tooltip}
                onClick={() => select(i)}
                onKeyDown={(event) => onTabKeyDown(event, i)}
                className={`relative inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all duration-300 ${
                  selected
                    ? "border-brand-900 bg-brand-900 text-white shadow-lg shadow-brand-900/20"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {selected && <Sparkles size={13} className="text-holo-400" />}
                {s.label}
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-zinc-400 mb-8 animate-in fade-in duration-300">
          {current.tooltip}
        </p>

        <div
          id={`style-panel-${current.key}`}
          role="region"
          aria-labelledby={`style-tab-${current.key}`}
          aria-live="polite"
          className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6"
        >
          {current.images.map((image) => (
            <div
              key={`${current.key}-${image.src}`}
              className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200/60 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-500"
            >
              <img
                src={image.src}
                alt={image.alt}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              {image.caption ? (
                <span className="absolute bottom-3 left-3 text-[11px] font-medium text-white bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
                  {image.caption}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
