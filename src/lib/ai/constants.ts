import "server-only";

// ── Engine classifier constants ──
// Shared between /api/generate and /api/tasks/[id] so both agree on which
// engines are async, which can fall back to flux, and which detail types
// bria can handle.

/** Engines that must be polled asynchronously (providers return processing, not outputs). */
export const ASYNC_ENGINES = new Set(["gemini", "banana", "gpt-image"]);

/** Engines that can fall back to flux when their provider isn't registered. */
export const FALLBACK_ENGINES = new Set(["gemini", "banana", "gpt-image", "bria"]);

/**
 * Bria detail types — scene/lifestyle photography with a real background.
 * White-bg studio composites (selling_points, material, etc.) are better served by flux.
 */
export const BRIA_SCENE_TYPES = new Set(["lifestyle", "scene_atmosphere", "in_use"]);
