import { env } from "@/lib/env";

export interface ImageGenerationResult {
  url: string;
  thumbnailUrl?: string;
  provider: string;
  metadata: Record<string, unknown>;
}

export interface VideoGenerationResult {
  url: string;
  thumbnailUrl?: string;
  durationSeconds: number;
  provider: string;
  metadata: Record<string, unknown>;
}

export interface AudioGenerationResult {
  url: string;
  durationSeconds: number;
  provider: string;
}

export interface ScriptGenerationResult {
  scenes: {
    index: number;
    description: string;
    voiceoverText: string;
    imagePrompt: string;
    videoPrompt: string;
    durationSeconds: number;
  }[];
  voiceover: string;
  hashtags: string[];
}

export interface ImageProvider {
  readonly name: string;
  generate(prompt: string, referenceImageUrl?: string): Promise<ImageGenerationResult>;
}

export interface VideoProvider {
  readonly name: string;
  generate(prompt: string, startImageUrl: string): Promise<VideoGenerationResult>;
}

export interface AudioProvider {
  readonly name: string;
  generate(text: string): Promise<AudioGenerationResult>;
}

export interface ScriptProvider {
  readonly name: string;
  generate(
    productTitle: string,
    productDescription: string,
    productImageUrl?: string
  ): Promise<ScriptGenerationResult>;
}
