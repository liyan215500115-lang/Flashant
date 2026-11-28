"use client";

export function QuotaRemainingBadge({
  label,
  status,
  value,
  retryLabel,
  exhausted,
  onRetry,
}: {
  label: string;
  status: "loading" | "ready" | "error";
  /** Ignored while status is error, even if the caller still holds 0/0. */
  value: string;
  retryLabel: string;
  exhausted: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      data-testid="quota-badge"
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border mt-2 ${
        exhausted
          ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-950 dark:border-red-800 dark:text-red-400"
          : "bg-zinc-50 border-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700"
      }`}
    >
      <span>{label}</span>
      {status === "error" ? (
        <>
          <span aria-hidden="true"> — </span>
          <button
            type="button"
            data-testid="quota-retry"
            className="underline underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
            onClick={onRetry}
          >
            {retryLabel}
          </button>
        </>
      ) : (
        <span className="font-mono tabular-nums" data-testid="quota-value">{value}</span>
      )}
    </div>
  );
}
