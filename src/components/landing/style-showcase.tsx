"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

interface StyleDef {
  key: string;
  label: string;
  tooltip: string;
  images: string[];
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
        <div className="flex items-center justify-center gap-2 mb-10 flex-wrap">
          {styles.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setActive(i)}
              className={`relative inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ${
                i === active
                  ? "bg-brand-900 text-white shadow-lg shadow-brand-900/20"
                  : "bg-zinc-50 text-zinc-600 hover:text-zinc-700 hover:bg-zinc-100"
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

        {/* 2x2 Image Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
          {current.images.map((src, i) => (
            <div
              key={`${current.key}-${i}`}
              className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200/60 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-500 cursor-pointer"
            >
              <img
                src={src}
                alt={`${current.label} example ${i + 1}`}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
