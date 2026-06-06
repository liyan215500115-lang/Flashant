"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors",
        className
      )}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <Sun size={15} className="text-zinc-400 hover:text-amber-400 transition-colors" />
      ) : (
        <Moon size={15} className="text-zinc-400 hover:text-brand-600 transition-colors" />
      )}
    </button>
  );
}
