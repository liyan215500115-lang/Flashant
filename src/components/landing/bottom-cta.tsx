import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/landing/logo-mark";

interface BottomCtaProps {
  title: string;
  subtitle: string;
  cta: string;
  ctaSub: string;
  userLoggedIn: boolean;
}

export function BottomCta({
  title,
  subtitle,
  cta,
  ctaSub,
  userLoggedIn,
}: BottomCtaProps) {
  return (
    <section className="py-24 md:py-32 px-6 relative overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#1E3A8A 1px, transparent 1px), linear-gradient(90deg, #1E3A8A 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative max-w-2xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-brand-900 text-white mb-8 shadow-xl shadow-brand-900/20">
          <LogoMark size={36} />
        </div>

        <h2 className="text-2xl md:text-4xl font-bold text-brand-900 tracking-tight">
          {title}
        </h2>
        <p className="mt-4 text-sm md:text-base text-zinc-500 leading-relaxed max-w-lg mx-auto">
          {subtitle}
        </p>

        <div className="mt-10">
          <Link
            href={userLoggedIn ? "/studio" : "/register"}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-900 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-800 transition-all duration-200 active:scale-[0.98] shadow-lg shadow-brand-900/20 hover:shadow-xl hover:shadow-brand-900/25"
          >
            {cta}
            <ArrowRight size={15} />
          </Link>
          <p className="mt-3 text-xs text-zinc-400">{ctaSub}</p>
        </div>
      </div>
    </section>
  );
}
