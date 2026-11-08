"use client";

import { useState } from "react";
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

export function StyleShowcase({ title, subtitle, styles }: StyleShowcaseProps) {
  const [active, setActive] = useState(0);
  const current = styles[active];

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

        {/* Tabs */}
        <div className="flex items-center justify-center gap-2 mb-10 flex-wrap" role="tablist">
          {styles.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              id={`style-tab-${s.key}`}
              aria-selected={i === active}
              aria-pressed={i === active}
              aria-controls={`style-panel-${s.key}`}
              onClick={() => setActive(i)}
              className={`relative inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 ${
                i === active
                  ? "border-brand-900 bg-brand-900 text-white shadow-lg shadow-brand-900/20"
                  : "border-zinc-300 bg-white text-zinc-800 shadow-sm hover:border-zinc-400 hover:bg-white"
              }`}
            >
              {i === active && <Sparkles size={13} className="text-holo-400" />}
              {s.label}
            </button>
          ))}
        </div>

        {/* Tooltip */}
        <p className="text-center text-xs text-zinc-400 mb-8 animate-in fade-in duration-300">
          {current.tooltip}
        </p>

        <div
          id={`style-panel-${current.key}`}
          role="tabpanel"
          aria-labelledby={`style-tab-${current.key}`}
          data-style-key={current.key}
          className={
            current.images.length > 1
              ? "grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6"
              : "mx-auto grid max-w-3xl grid-cols-1"
          }
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
