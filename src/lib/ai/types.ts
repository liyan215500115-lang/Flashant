export interface ImageGenerationInput {
  prompt: string;
  productImageUrl: string;
  /** Optional reference image for style/person consistency */
  referenceImageUrl?: string;
  width?: number;
  height?: number;
  numOutputs?: number;
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
    }
  >;
  getPrediction(predictionId: string): Promise<ImageGenerationResult>;
  isReady(predictionId: string): Promise<boolean>;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}
