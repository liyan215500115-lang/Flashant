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
 * Poll cap for one shot that has already started.
 * Six full waits are 240s, which fits in the 270s budget with time left
 * for the debit, the provider call, and storing each result.
 */
export const PER_SHOT_WAIT_MS = 40_000;

/** Do not debit a shot when the pack budget cannot actually run it. */
export const MIN_START_MS = 5_000;

/** A shot that never started. Not a provider timeout, and not charged. */
export const NOT_STARTED_REASON = "not_started";
