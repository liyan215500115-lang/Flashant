"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function Checkbox({
  className,
  checked,
  onCheckedChange,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      className={cn(
        "h-4 w-4 rounded border-zinc-300 dark:border-zinc-500 text-brand-900 dark:text-brand-300 focus:ring-brand-500 cursor-pointer",
        className
      )}
      {...props}
    />
  );
}

export { Checkbox };
