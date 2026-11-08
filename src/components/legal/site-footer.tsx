import Link from "next/link";
import { Logo } from "@/components/landing/logo";
import { SUPPORT_EMAIL } from "@/lib/legal/copy";

const LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/acceptable-use", label: "Acceptable Use" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteFooter({ copyright }: { copyright?: string }) {
  return (
    <footer className="py-10 px-6 border-t border-zinc-100 bg-white">
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-4">
        <Logo size={22} />
        <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-zinc-600 hover:text-brand-700 underline-offset-4 hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="text-sm text-zinc-700 hover:text-brand-700"
        >
          {SUPPORT_EMAIL}
        </a>
        {copyright ? <p className="text-xs text-zinc-400">{copyright}</p> : null}
      </div>
    </footer>
  );
}
