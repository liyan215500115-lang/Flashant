"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 mb-6">
      <Link href="/dashboard" className="hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
        Home
      </Link>
      {items.map((item, i) => (
        <Fragment key={i}>
          <ChevronRight size={13} className="text-zinc-300 dark:text-zinc-500" />
          {item.href ? (
            <Link href={item.href} className="hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-zinc-900 dark:text-zinc-100 font-medium">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
