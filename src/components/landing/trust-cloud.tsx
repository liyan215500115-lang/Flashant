import {
  Package,
  ShoppingBag,
  Music4,
  Gem,
  Globe,
  Zap,
} from "lucide-react";
import { LogoMark } from "@/components/landing/logo-mark";

const PLATFORMS = [
  { name: "Amazon", icon: Package, color: "text-amber-500", bg: "bg-amber-50" },
  { name: "Shopify", icon: ShoppingBag, color: "text-emerald-600", bg: "bg-emerald-50" },
  { name: "TikTok Shop", icon: Music4, color: "text-zinc-800", bg: "bg-zinc-50" },
  { name: "Etsy", icon: Gem, color: "text-orange-500", bg: "bg-orange-50" },
  { name: "Mercado Libre", icon: Globe, color: "text-brand-700", bg: "bg-brand-50" },
];

interface TrustCloudProps {
  title: string;
  subtitle: string;
}

export function TrustCloud({ title, subtitle }: TrustCloudProps) {
  return (
    <section className="py-20 md:py-28 px-6 bg-zinc-50/50 relative overflow-hidden">
      {/* Subtle dot grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(#1E3A8A 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-[11px] font-semibold uppercase tracking-wider mb-4">
            <Zap size={11} className="text-holo-500" />
            One-Click Integrations
          </div>
          <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">
            {title}
          </h3>
        </div>

        {/* Hub & Spoke layout */}
        <div className="relative flex flex-col items-center">
          {/* Central hub */}
          <div className="relative z-10 flex items-center justify-center w-20 h-20 rounded-3xl bg-white border-2 border-brand-100 shadow-lg shadow-brand-900/5 mb-8">
            <LogoMark size={40} />
          </div>

          {/* Dashed connector ring */}
          <div className="absolute top-10 w-80 h-80 md:w-[520px] md:h-[520px] rounded-full border border-dashed border-zinc-200" />

          {/* Platform nodes — positioned around the ring */}
          <div className="relative w-full max-w-[560px] aspect-square">
            {PLATFORMS.map((p, i) => {
              const Icon = p.icon;
              // 5 nodes evenly spaced on the circle, starting from top
              const angle = (i * 72 - 90) * (Math.PI / 180);
              const radius = 42; // percent
              const x = 50 + radius * Math.cos(angle);
              const y = 50 + radius * Math.sin(angle);

              return (
                <div
                  key={p.name}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 group"
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  {/* Connector line from hub to node */}
                  <div className="absolute top-1/2 left-1/2 w-full h-px -z-10 opacity-0" />

                  {/* Icon badge */}
                  <div
                    className={`relative w-12 h-12 md:w-14 md:h-14 rounded-2xl ${p.bg} flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300 group-hover:scale-110`}
                  >
                    <Icon size={20} className={`${p.color} md:size-[22px]`} />
                    {/* Dot connector indicator */}
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-holo-500 ring-2 ring-white" />
                  </div>

                  {/* Name */}
                  <span className="text-[11px] md:text-xs font-semibold text-zinc-600 group-hover:text-brand-900 transition-colors text-center leading-tight">
                    {p.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subtitle */}
        <p className="mt-10 text-center text-xs text-zinc-400">{subtitle}</p>
      </div>
    </section>
  );
}
