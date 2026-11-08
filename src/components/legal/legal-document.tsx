import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/landing/logo";
import { SiteFooter } from "@/components/legal/site-footer";

export function LegalDocument({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-800 flex flex-col">
      <header className="bg-white border-b border-zinc-100">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" aria-label="Flashant home">
            <Logo size={26} />
          </Link>
          <Link href="/contact" className="text-sm text-zinc-600 hover:text-brand-700">
            Contact
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">{title}</h1>
          <p className="mt-3 text-sm text-zinc-500">Last updated 8 November 2026. {description}</p>
          <div className="mt-8 space-y-8 text-[15px] leading-7 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-900 [&_h2]:mt-0 [&_p]:text-zinc-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ul]:text-zinc-700 [&_a]:text-brand-700 [&_a]:underline">
            {children}
          </div>
        </article>
      </main>
      <SiteFooter copyright="© 2026 Flashant. All rights reserved." />
    </div>
  );
}
