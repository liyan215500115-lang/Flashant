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
    <section className="py-32 md:py-40 px-6 bg-white">
      <div className="max-w-2xl mx-auto text-center animate-on-scroll">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-50 mb-8" style={{animation: "float 5s ease-in-out infinite"}}>
          <LogoMark size={32} />
        </div>
        <h2 className="text-2xl md:text-4xl font-bold text-zinc-900 tracking-tight">{title}</h2>
        <p className="mt-4 text-base text-zinc-500 leading-relaxed max-w-md mx-auto">{subtitle}</p>
        <div className="mt-10">
          <Link href={userLoggedIn ? "/studio" : "/register"}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-900 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-800 transition-all duration-200 active:scale-[0.98] shadow-md">
            {cta}<ArrowRight size={15} />
          </Link>
          <p className="mt-4 text-sm text-zinc-400">{ctaSub}</p>
        </div>
      </div>
    </section>
  );
}
