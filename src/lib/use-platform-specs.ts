"use client";

import { useT } from "@/components/i18n-provider";
import type { PlatformImageSpec } from "@/lib/platform-specs";

export interface LocalizedPlatformSpec extends PlatformImageSpec {
  localizedName: string;
  localizedBackground: string;
  localizedNotes: string[];
}

function resolveKey(t: (key: string) => string, key: string, fallback: string): string {
  const result = t(key);
  return result === key ? fallback : result;
}

export function usePlatformSpec(spec: PlatformImageSpec): LocalizedPlatformSpec {
  const { t } = useT();
  const prefix = `platforms.${spec.platform}`;

  return {
    ...spec,
    localizedName: resolveKey(t, `${prefix}.name`, spec.name),
    localizedBackground: resolveKey(t, `${prefix}.background`, spec.background),
    localizedNotes: spec.notes
      .map((note, i) => resolveKey(t, `${prefix}.notes.${i}`, note))
      .filter(Boolean),
  };
}
