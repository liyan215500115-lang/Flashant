import { stylePromptFragments } from "@/lib/ai/style-prompts";
import { PLATFORM_SPECS } from "@/lib/platform-specs";

/**
 * Fallback prompt the model sees when a request has no user text.
 * That case is still screened, using SCREEN_PLACEHOLDERS rather than this template.
 */
export const DEFAULT_GENERATION_PROMPT =
  "Professional product photography, studio lighting, high quality";

/**
 * Canned prompt text shared by the studio style picker, platform suffixes, and
 * the generic product-photography fallback. Server-side scene templates are
 * added by the generate route because they live next to that handler.
 */
export function sharedStaticPromptFragments(): string[] {
  return [
    DEFAULT_GENERATION_PROMPT,
    "Professional product photography",
    ...Object.values(PLATFORM_SPECS).map((spec) => spec.promptSuffix),
    ...stylePromptFragments(),
  ];
}
