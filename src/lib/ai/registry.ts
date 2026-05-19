import "server-only";

import type { ImageProvider } from "./types";
import { initProviders } from "./init";

const providers = new Map<string, ImageProvider>();

// Register providers at module load time (runs once per process)
initProviders();

export function registerProvider(name: string, provider: ImageProvider): void {
  providers.set(name, provider);
}

export function getProvider(name?: string): ImageProvider {
  const key = name ?? process.env.AI_PROVIDER ?? "flux";
  const provider = providers.get(key);
  if (!provider) {
    throw new Error(`AI provider "${key}" not registered. Check environment variables.`);
  }
  return provider;
}

export function listProviders(): string[] {
  return Array.from(providers.keys());
}
