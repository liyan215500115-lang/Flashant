"use client";

import { useState } from "react";
import {
  Package, ShoppingBag, Music4, Gem, Globe,
  Zap, Monitor, ShoppingCart, Smartphone, Store, Tablet, X,
} from "lucide-react";

const TOP_PLATFORMS = [
  { name: "Amazon", icon: Package, color: "text-amber-600", bg: "bg-amber-50" },
  { name: "Shopify", icon: ShoppingBag, color: "text-emerald-600", bg: "bg-emerald-50" },
  { name: "TikTok Shop", icon: Music4, color: "text-zinc-700", bg: "bg-zinc-100" },
  { name: "Etsy", icon: Gem, color: "text-orange-600", bg: "bg-orange-50" },
];

const MORE_PLATFORMS = [
  { name: "Mercado Libre", icon: Globe, color: "text-brand-700", bg: "bg-brand-50" },
  { name: "eBay", icon: ShoppingCart, color: "text-red-600", bg: "bg-red-50" },
  { name: "Walmart", icon: Store, color: "text-blue-600", bg: "bg-blue-50" },
  { name: "Lazada", icon: Monitor, color: "text-purple-600", bg: "bg-purple-50" },
  { name: "Shopee", icon: Tablet, color: "text-orange-500", bg: "bg-orange-50" },
  { name: "Taobao", icon: Smartphone, color: "text-orange-600", bg: "bg-orange-50" },
  { name: "Tmall", icon: Store, color: "text-red-500", bg: "bg-red-50" },
  { name: "JD", icon: Monitor, color: "text-red-600", bg: "bg-red-50" },
  { name: "Pinduoduo", icon: ShoppingCart, color: "text-red-500", bg: "bg-red-50" },
  { name: "Douyin Shop", icon: Music4, color: "text-zinc-700", bg: "bg-zinc-100" },
];

interface TrustCloudProps {
  title: string;
  subtitle: string;
}

export function TrustCloud({ title, subtitle }: TrustCloudProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="py-32 md:py-40 px-6 bg-white">
      <div className="max-w-3xl mx-auto text-center animate-on-scroll">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-medium mb-6">
          <Zap size={12} className="text-holo-500" /> One-Click Publishing
        </div>
        <h3 className="text-lg font-semibold text-zinc-800 mb-2">{title}</h3>
        <p className="text-sm text-zinc-500 mb-12">{subtitle}</p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          {TOP_PLATFORMS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.name}
                className={`flex items-center gap-3 rounded-2xl border border-zinc-100 px-5 py-3 ${p.bg} group hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-default`}
              >
                <div className={p.color}><Icon size={22} strokeWidth={1.5} /></div>
                <span className="text-sm font-semibold text-zinc-700">{p.name}</span>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-3 hover:border-brand-300 hover:bg-brand-50 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
          >
            <span className="text-sm font-semibold text-zinc-500 hover:text-brand-700">+10 more</span>
          </button>
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-base font-semibold text-zinc-900">14 supported platforms</h4>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[...TOP_PLATFORMS, ...MORE_PLATFORMS].map((p) => {
                const Icon = p.icon;
                return (
                  <div key={p.name} className={`flex items-center gap-3 rounded-xl px-4 py-2.5 ${p.bg}`}>
                    <div className={p.color}><Icon size={18} strokeWidth={1.5} /></div>
                    <span className="text-sm font-medium text-zinc-700">{p.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
