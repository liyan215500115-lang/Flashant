/**
 * Hobby Fluid Compute default and maximum are both 300 seconds.
 * Pro can be configured up to 800. This production project is on Hobby,
 * so the route maxDuration must stay at 300 or the deploy fails.
 */
export const HOBBY_MAX_DURATION_SECONDS = 300;

/**
 * Reserved after the pack budget so the handler can store a late image,
 * refund a debit, and write the project status before the platform kills
 * the function at maxDuration.
 */
export const PACK_CLOSE_MARGIN_MS = 30_000;

/** Shared close-out clock for one pack. 300s - 30s. */
export const PACK_BUDGET_MS = HOBBY_MAX_DURATION_SECONDS * 1000 - PACK_CLOSE_MARGIN_MS;

/**
 * Minimum time we require before debiting another shot.
 * Six of these are 240s, which fits in the 270s budget.
 * An in-flight shot is not cut off here. It keeps polling until the pack budget,
 * because a slow shot can run longer than 40s while minutes are still left.
 */
export const PER_SHOT_WAIT_MS = 40_000;

/** Do not debit a shot unless one full shot wait still fits in the pack budget. */
export const MIN_START_MS = PER_SHOT_WAIT_MS;

/**
 * Minimum space between prediction creates.
 * A low-balance Replicate account drops to about 6 requests per minute with burst 1.
 * A create that just succeeded, or a create that just returned 429, will 429 the next
 * create if it starts in the same burst. This gap is skipped when the previous create
 * is already older than the gap, so a long poll does not add it again.
 * The same shot's own 429 retry waits for retry_after instead of this gap.
 */
export const PREDICTION_CREATE_GAP_MS = 10_000;

/** A shot that never started. Not a provider timeout, and not charged. */
export const NOT_STARTED_REASON = "not_started";
