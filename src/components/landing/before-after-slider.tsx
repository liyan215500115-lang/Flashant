"use client";

import { useState, useRef, useCallback } from "react";
import { ArrowLeftRight } from "lucide-react";

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export function BeforeAfterSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = "Original",
  afterLabel = "AI Generated",
}: BeforeAfterSliderProps) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      setPosition(x * 100);
    },
    []
  );

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div
        ref={containerRef}
        className="relative aspect-[16/10] rounded-2xl overflow-hidden select-none bg-zinc-100 border border-zinc-100"
        onMouseMove={(e) => {
          if (e.buttons === 1) handleMove(e.clientX);
        }}
        onTouchMove={(e) => {
          handleMove(e.touches[0].clientX);
        }}
      >
        {/* Before image — full width behind */}
        <img
          src={beforeSrc}
          alt={beforeLabel}
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />

        {/* After image — clipped from left */}
        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 0 0 ${position}%)` }}
        >
          <img
            src={afterSrc}
            alt={afterLabel}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        </div>

        {/* Divider line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white shadow-lg pointer-events-none"
          style={{ left: `${position}%` }}
        />

        {/* Handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-lg border-2 border-zinc-200 flex items-center justify-center pointer-events-none"
          style={{ left: `${position}%` }}
        >
          <ArrowLeftRight size={14} className="text-zinc-400" />
        </div>

        {/* Labels */}
        <span
          className="absolute bottom-4 left-4 text-xs font-medium text-white bg-black/40 backdrop-blur-sm rounded-full px-3 py-1 pointer-events-none transition-opacity"
          style={{ opacity: position > 20 ? 1 : 0.3 }}
        >
          {beforeLabel}
        </span>
        <span
          className="absolute bottom-4 right-4 text-xs font-medium text-white bg-black/40 backdrop-blur-sm rounded-full px-3 py-1 pointer-events-none transition-opacity"
          style={{ opacity: position < 80 ? 1 : 0.3 }}
        >
          {afterLabel}
        </span>
      </div>

      {/* Range slider */}
      <div className="mt-6 px-4">
        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          className="w-full h-1 appearance-none bg-zinc-200 rounded-full cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-300
            [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-grab
            [&::-webkit-slider-thumb]:transition-shadow [&::-webkit-slider-thumb]:hover:shadow-md
            [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
            [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-zinc-300
            [&::-moz-range-thumb]:shadow-sm [&::-moz-range-thumb]:cursor-grab
            [&::-moz-range-thumb]:border-none"
        />
      </div>
    </div>
  );
}
