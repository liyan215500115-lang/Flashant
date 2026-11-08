"use client";

import { useState, type CSSProperties, type Dispatch, type MouseEvent, type SetStateAction } from "react";
import { LogoMark } from "@/components/landing/logo-mark";

interface HeroCardsProps {
  beforeSrc: string;
  afterSrc: string;
  beforeAlt: string;
  afterAlt: string;
  beforeBadge: string;
  afterBadge: string;
  beforeCaption: string;
  afterCaption: string;
  footnote: string;
}

export function HeroCards({
  beforeSrc,
  afterSrc,
  beforeAlt,
  afterAlt,
  beforeBadge,
  afterBadge,
  beforeCaption,
  afterCaption,
  footnote,
}: HeroCardsProps) {
  const [beforeStyle, setBeforeStyle] = useState<CSSProperties>({});
  const [afterStyle, setAfterStyle] = useState<CSSProperties>({});

  function handleMove(
    e: MouseEvent<HTMLDivElement>,
    setStyle: Dispatch<SetStateAction<CSSProperties>>
  ) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setStyle({
      transform: `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 6}deg) translateZ(4px)`,
      transition: "transform 0.1s ease-out",
    });
  }

  function handleLeave(
    setStyle: Dispatch<SetStateAction<CSSProperties>>
  ) {
    setStyle({
      transform: "perspective(800px) rotateY(0deg) rotateX(0deg) translateZ(0px)",
      transition: "transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)",
    });
  }

  return (
    <div className="flex-1 max-w-lg w-full">
      <div className="grid grid-cols-2 gap-4">
        <div
          style={beforeStyle}
          onMouseMove={(e) => handleMove(e, setBeforeStyle)}
          onMouseLeave={() => handleLeave(setBeforeStyle)}
          className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden cursor-pointer will-change-transform"
        >
          <div className="aspect-[3/4] relative">
            <img
              src={beforeSrc}
              alt={beforeAlt}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-zinc-900/5" />
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
              <span className="inline-block rounded-lg bg-zinc-800/70 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-white uppercase tracking-wider shadow-sm">
                {beforeBadge}
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/80 to-transparent pt-6 pb-2.5 px-3">
              <p className="text-[11px] text-zinc-500 font-medium">{beforeCaption}</p>
            </div>
          </div>
        </div>

        <div
          style={afterStyle}
          onMouseMove={(e) => handleMove(e, setAfterStyle)}
          onMouseLeave={() => handleLeave(setAfterStyle)}
          className="relative rounded-2xl border-2 border-brand-200 bg-white shadow-lg shadow-brand-900/10 overflow-hidden cursor-pointer will-change-transform"
        >
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-holo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="aspect-[3/4] relative">
            <img
              src={afterSrc}
              alt={afterAlt}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-holo-500/[0.06] pointer-events-none" />
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-900/80 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-white uppercase tracking-wider shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-holo-500 animate-pulse" />
                {afterBadge}
              </span>
              <LogoMark size={18} />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/85 to-transparent pt-6 pb-2.5 px-3">
              <p className="text-[11px] text-brand-700 font-semibold">{afterCaption}</p>
            </div>
          </div>
          <div className="absolute inset-x-3 bottom-3 h-px rounded-full bg-gradient-to-r from-transparent via-holo-500/40 to-transparent" />
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-zinc-400">
        {footnote}
      </p>
    </div>
  );
}
