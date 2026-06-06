"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-zinc-200/70 bg-white p-5 space-y-4", className)}>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}

export function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-zinc-200/70 bg-white p-5 space-y-3", className)}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-12" />
      <Skeleton className="h-2 w-28" />
    </div>
  );
}

export function SkeletonImageGrid({
  columns = 3,
  rows = 2,
  className,
}: {
  columns?: number;
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-3", className)}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {Array.from({ length: columns * rows }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-lg" />
      ))}
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  columns = 3,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-4 pb-2 border-b border-zinc-100">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-24" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-64" />
    </div>
  );
}
