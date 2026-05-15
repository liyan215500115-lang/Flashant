import type { ImageProvider } from "./types";

const providers = new Map<string, ImageProvider>();

export function registerProvider(name: string, provider: ImageProvider): void {
  providers.set(name, provider);
}

export function getProvider(name?: string): ImageProvider {
  const key = name ?? process.env.AI_PROVIDER ?? "replicate";
  const provider = providers.get(key);
  if (!provider) {
    throw new Error(`AI provider "${key}" not registered`);
  }
  return provider;
}

export function listProviders(): string[] {
  return Array.from(providers.keys());
}
