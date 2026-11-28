import Link from "next/link";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The studio href for an existing project. The control itself is this link. */
export function projectStudioHref(projectId: string): string {
  return `/studio?projectId=${projectId}`;
}

/**
 * Outline control that navigates to the studio. It is an anchor, not a button
 * nested in a link: a native button inside an anchor is the activation target,
 * so the click does not reliably follow the href.
 */
export function AiEditLink({
  projectId,
  className,
  children,
}: {
  projectId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={projectStudioHref(projectId)}
      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "cursor-pointer gap-1.5", className)}
    >
      {children}
    </Link>
  );
}
