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
  /** Ignored while status is error or loading, even if the caller still holds 0/0 or an ellipsis. */
  value: string;
  retryLabel: string;
  exhausted: boolean;
  onRetry: () => void;
}) {
  if (status === "loading") {
    return (
      <div
        data-testid="quota-badge"
        className="pd-quota inline-flex min-w-[13em] shrink-0 items-center overflow-visible whitespace-nowrap"
        aria-busy="true"
        aria-label={label}
      >
        <span className="pd-quota-skel" data-testid="quota-skel" />
      </div>
    );
  }

  return (
    <div
      data-testid="quota-badge"
      className="pd-quota inline-flex min-w-[13em] shrink-0 items-baseline overflow-visible whitespace-nowrap"
    >
      <span>{label}</span>
      {status === "error" ? (
        <>
          <span aria-hidden="true"> — </span>
          <button
            type="button"
            data-testid="quota-retry"
            className="pd-quota-retry"
            onClick={onRetry}
          >
            {retryLabel}
          </button>
        </>
      ) : (
        <span
          className={`pd-fig tabular-nums${exhausted ? " is-exhausted" : ""}`}
          data-testid="quota-value"
        >
          {value}
        </span>
      )}
    </div>
  );
}
