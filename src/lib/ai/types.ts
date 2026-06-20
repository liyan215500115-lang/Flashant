export interface ImageGenerationInput {
  prompt: string;
  productImageUrl: string;
  /** Optional reference image for style/person consistency */
  referenceImageUrl?: string;
  width?: number;
  height?: number;
  numOutputs?: number;
  /** Random seed for reproducible generation (engines that support it) */
  seed?: number;
  /** Override the default model version for this prediction */
  modelVersion?: string;
}

export interface ImageGenerationOutput {
  id: string;
  url: string;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
}

export interface ImageGenerationResult {
  outputs: ImageGenerationOutput[];
  status: "succeeded" | "processing" | "failed";
  error?: string;
  webhookId?: string;
}

export interface ImageProvider {
  readonly name: string;
  createPrediction(
    input: ImageGenerationInput
  ): Promise<
    Pick<ImageGenerationResult, "status" | "error" | "webhookId"> & {
      predictionId: string;
      // Synchronous providers (gemini/gpt-image) return outputs immediately; async providers
      // (replicate) leave them empty and fill them via getPrediction. Optional for that reason.
      outputs?: ImageGenerationOutput[];
    }
  >;
  getPrediction(predictionId: string): Promise<ImageGenerationResult>;
  isReady(predictionId: string): Promise<boolean>;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}
