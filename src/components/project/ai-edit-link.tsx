import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The studio href for an existing project. The control itself is this link. */
export function projectStudioHref(projectId: string): string {
  return `/studio?projectId=${projectId}`;
}

const VARIANT_CLASS = {
  outline: "pd-btn pd-btn-studio",
  primary: "pd-btn pd-btn-primary pd-btn-studio",
  tile: "pd-shot-add",
  bar: "pd-shot-add-bar",
} as const;

/**
 * Studio navigation. It is an anchor, not a button nested in a link: a native
 * button inside an anchor is the activation target, so the click does not
 * reliably follow the href.
 */
export function AiEditLink({
  projectId,
  className,
  children,
  variant = "outline",
  title,
  testId,
}: {
  projectId: string;
  className?: string;
  children: ReactNode;
  variant?: keyof typeof VARIANT_CLASS;
  title?: string;
  testId?: string;
}) {
  return (
    <Link
      href={projectStudioHref(projectId)}
      data-studio="true"
      data-emphasis={variant === "primary" ? "primary" : undefined}
      data-testid={testId}
      title={title}
      className={cn(VARIANT_CLASS[variant], className)}
    >
      {children}
    </Link>
  );
}
