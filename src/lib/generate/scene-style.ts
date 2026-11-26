import { STYLE_PROMPTS, type StylePrompt } from "@/lib/ai/style-prompts";

/**
 * Scene shots (使用场景 / 场景氛围 / 使用中) take their setting from the
 * left-side style. Style lock is a different switch: it keeps the same
 * product and person across the pack, and it is the only time `baseStyle`
 * is sent. The selected style still has to win when that lock is off.
 */
const SCENE_SHOTS = new Set(["lifestyle", "scene_atmosphere", "in_use"]);

const SCENE_ROLES: Record<string, string> = {
  lifestyle:
    "Shot role is usage context only: place or use the product in the selected style's setting, with a camera height and placement distinct from an atmosphere hero",
  scene_atmosphere:
    "Shot role is emotional space only: the product is a lone hero in the selected style's setting, with generous negative space and a camera position distinct from the usage shot",
  in_use:
    "Shot role is in use only: the product is being used or worn in the selected style's setting",
};

/**
 * Environment, lighting, and mood for each left-side style.
 * These replace the shot template's lighting and the category surface hint.
 * They do not add a room, a rim light, or props the style itself does not ask for.
 */
const SCENE_SETTINGS: Record<string, string> = {
  white: "a pure white seamless background with soft even studio light and no props",
  scene: "a bright modern interior with natural window light and a warm editorial mood",
  in_use: "a candid real-life setting with soft daylight while the product is in use",
  angles: "even studio light on a pure white background",
  marble: "a quiet luxury surface with one soft directional key light and desaturated editorial tones",
  natural:
    "a golden-hour outdoor setting — mossy stone, a weathered wood bench, wild grass, or a sandy beach — with warm directional sunset sunlight",
  cosy: "a warm hygge home interior with linen-filtered light, wood, and a quiet morning mood",
  dark_moody: "a deep black background with one dramatic spotlight and a cinematic mood",
  cyberpunk: "a dark wet surface with cyan and magenta neon, fog, and a night-city mood",
  canvas: "an artist-studio canvas surface with soft north light and watercolor surroundings",
  kawaii: "a soft pastel setting with even diffused light and a playful mood",
  infographic: "a clean white product field with even studio light beside a simple information panel",
};

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function styleVariants(style: StylePrompt): string[] {
  const briaEn = style.promptFlux.replace(/Keep the product identical to the reference image,?\s*/i, "");
  const briaZh = style.promptFluxZh.replace(/保持产品与参考图完全一致[，,]?\s*/g, "");
  return [style.prompt, style.promptZh, style.promptFlux, style.promptFluxZh, briaEn, briaZh];
}

export function isSceneShot(detailKey: string): boolean {
  return SCENE_SHOTS.has(detailKey);
}

export function styleByKey(key: string | null | undefined): StylePrompt | null {
  const trimmed = key?.trim();
  if (!trimmed) return null;
  return STYLE_PROMPTS.find((style) => style.key === trimmed) ?? null;
}

/** The left prompt is already one style's full scene description. */
export function matchSelectedStyle(text: string | null | undefined): StylePrompt | null {
  const haystack = normalize(text ?? "");
  if (haystack.length < 48) return null;
  let best: { style: StylePrompt; length: number } | null = null;
  for (const style of STYLE_PROMPTS) {
    for (const variant of styleVariants(style)) {
      const needle = normalize(variant);
      if (needle.length < 48 || !haystack.includes(needle)) continue;
      if (!best || needle.length > best.length) best = { style, length: needle.length };
    }
  }
  return best?.style ?? null;
}

export function resolveSelectedStyle(input: {
  sceneStyleKey?: string | null;
  texts?: Array<string | null | undefined>;
}): StylePrompt | null {
  const byKey = styleByKey(input.sceneStyleKey);
  if (byKey) return byKey;
  for (const text of input.texts ?? []) {
    const matched = matchSelectedStyle(text);
    if (matched) return matched;
  }
  return null;
}

export function sceneShotRole(detailKey: string): string {
  return SCENE_ROLES[detailKey] ?? "Shot role stays with this scene type, inside the selected style's setting";
}

export function sceneStyleHint(style: StylePrompt): string {
  const setting = SCENE_SETTINGS[style.key] ?? style.promptFlux;
  return `Selected style controls the environment, lighting, and mood (${style.zh}): ${setting}. Keep this shot in that setting. Do not switch the setting to the shot template's lighting or the category's default materials`;
}

export function sceneStyleStaticFragments(): string[] {
  return [
    ...Object.values(SCENE_ROLES),
    ...STYLE_PROMPTS.map((style) => sceneStyleHint(style)),
  ];
}
