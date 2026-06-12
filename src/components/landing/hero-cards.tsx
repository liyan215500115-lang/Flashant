"use client";

import { useRef, useState, type MouseEvent } from "react";
import { LogoMark } from "@/components/landing/logo-mark";

export function HeroCards() {
  const beforeRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLDivElement>(null);
  const [beforeStyle, setBeforeStyle] = useState<React.CSSProperties>({});
  const [afterStyle, setAfterStyle] = useState<React.CSSProperties>({});

  function handleMove(
    e: MouseEvent<HTMLDivElement>,
    setStyle: React.Dispatch<React.SetStateAction<React.CSSProperties>>
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
    setStyle: React.Dispatch<React.SetStateAction<React.CSSProperties>>
  ) {
    setStyle({
      transform: "perspective(800px) rotateY(0deg) rotateX(0deg) translateZ(0px)",
      transition: "transform 0.6s cubic-bezier(0.23, 1, 0.32, 1)",
    });
  }

  return (
    <div className="flex-1 max-w-lg w-full">
      <div className="grid grid-cols-2 gap-4">
        {/* Before */}
        <div
          ref={beforeRef}
          style={beforeStyle}
          onMouseMove={(e) => handleMove(e, setBeforeStyle)}
          onMouseLeave={() => handleLeave(setBeforeStyle)}
          className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden cursor-pointer will-change-transform"
        >
          <div className="aspect-[3/4] relative">
            <img
              src="https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=533&fit=crop&q=60"
              alt="Raw product photo"
              className="absolute inset-0 w-full h-full object-cover grayscale-[30%] brightness-75 saturate-30"
            />
            <div className="absolute inset-0 bg-zinc-900/5" />
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
              <span className="inline-block rounded-lg bg-zinc-800/70 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-white uppercase tracking-wider shadow-sm">
                Before
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/80 to-transparent pt-6 pb-2.5 px-3">
              <p className="text-[11px] text-zinc-500 font-medium">Raw phone photo</p>
            </div>
          </div>
        </div>

        {/* After */}
        <div
          ref={afterRef}
          style={afterStyle}
          onMouseMove={(e) => handleMove(e, setAfterStyle)}
          onMouseLeave={() => handleLeave(setAfterStyle)}
          className="rounded-2xl border-2 border-brand-200 bg-white shadow-lg shadow-brand-900/10 overflow-hidden cursor-pointer will-change-transform"
        >
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-holo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="aspect-[3/4] relative">
            <img
              src="https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400&h=533&fit=crop&q=90"
              alt="AI transformed product advertisement"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.06] via-transparent to-holo-500/[0.06] pointer-events-none" />
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-900/80 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-white uppercase tracking-wider shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-holo-500 animate-pulse" />
                After
              </span>
              <LogoMark size={18} />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/85 to-transparent pt-6 pb-2.5 px-3">
              <p className="text-[11px] text-brand-700 font-semibold">AI studio-quality</p>
            </div>
          </div>
          <div className="absolute inset-x-3 bottom-3 h-px rounded-full bg-gradient-to-r from-transparent via-holo-500/40 to-transparent" />
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-zinc-400">
        From smartphone snap to studio-quality ad. Same product, transformed in seconds.
      </p>
    </div>
  );
}
