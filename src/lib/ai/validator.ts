import "server-only";

import type { ValidationResult } from "./types";

const MIN_FILE_SIZE = 1024; // 1KB
const MIN_WIDTH = 200;
const MIN_HEIGHT = 200;
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function validateImage(metadata: {
  fileSize: number;
  mimeType: string;
  width: number;
  height: number;
}): ValidationResult {
  if (metadata.fileSize < MIN_FILE_SIZE) {
    return {
      valid: false,
      reason: `File size ${metadata.fileSize} bytes is below minimum ${MIN_FILE_SIZE} bytes`,
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(metadata.mimeType)) {
    return {
      valid: false,
      reason: `MIME type "${metadata.mimeType}" not allowed. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
    };
  }

  if (metadata.width < MIN_WIDTH || metadata.height < MIN_HEIGHT) {
    return {
      valid: false,
      reason: `Image dimensions ${metadata.width}x${metadata.height} below minimum ${MIN_WIDTH}x${MIN_HEIGHT}`,
    };
  }

  return { valid: true };
}

export function validateUploadedFile(file: {
  size: number;
  type: string;
}): ValidationResult {
  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/jpg",
  ];
  const maxSize = 20 * 1024 * 1024; // 20MB

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      reason: `File type "${file.type}" not supported. Allowed: PNG, JPEG, WebP`,
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      reason: `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds maximum 20MB`,
    };
  }

  if (file.size === 0) {
    return { valid: false, reason: "File is empty" };
  }

  return { valid: true };
}
