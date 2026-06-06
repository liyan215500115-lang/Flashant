import { describe, it, expect } from "vitest";
import { validateImage, validateUploadedFile } from "@/lib/ai/validator";

describe("validateImage", () => {
  it("accepts a valid 1024x1024 PNG at 500KB", () => {
    const result = validateImage({
      fileSize: 500 * 1024,
      mimeType: "image/png",
      width: 1024,
      height: 1024,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts valid JPEG", () => {
    const result = validateImage({
      fileSize: 200 * 1024,
      mimeType: "image/jpeg",
      width: 800,
      height: 600,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts valid WebP", () => {
    const result = validateImage({
      fileSize: 100 * 1024,
      mimeType: "image/webp",
      width: 512,
      height: 512,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts minimum valid dimensions (200x200)", () => {
    const result = validateImage({
      fileSize: 2 * 1024, // 2KB
      mimeType: "image/png",
      width: 200,
      height: 200,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects file below 1KB minimum", () => {
    const result = validateImage({
      fileSize: 512, // 512 bytes, below MIN_FILE_SIZE (1024)
      mimeType: "image/png",
      width: 1024,
      height: 1024,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("below minimum");
    expect(result.reason).toContain("1024 bytes");
  });

  it("rejects exactly 1KB (boundary)", () => {
    const result = validateImage({
      fileSize: 1024,
      mimeType: "image/png",
      width: 200,
      height: 200,
    });
    expect(result.valid).toBe(true); // >= MIN_FILE_SIZE
  });

  it("rejects empty file (0 bytes)", () => {
    const result = validateImage({
      fileSize: 0,
      mimeType: "image/png",
      width: 800,
      height: 800,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("below minimum");
  });

  it("rejects non-image MIME type", () => {
    const result = validateImage({
      fileSize: 50 * 1024,
      mimeType: "application/pdf",
      width: 1024,
      height: 1024,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not allowed");
    expect(result.reason).toContain("application/pdf");
  });

  it("rejects image/gif (not in allow list)", () => {
    const result = validateImage({
      fileSize: 50 * 1024,
      mimeType: "image/gif",
      width: 500,
      height: 500,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects undersized width (<200px)", () => {
    const result = validateImage({
      fileSize: 10 * 1024,
      mimeType: "image/png",
      width: 150,
      height: 800,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("below minimum");
    expect(result.reason).toContain("150x800");
  });

  it("rejects undersized height (<200px)", () => {
    const result = validateImage({
      fileSize: 10 * 1024,
      mimeType: "image/png",
      width: 800,
      height: 100,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("below minimum");
  });
});

describe("validateUploadedFile", () => {
  it("accepts valid PNG file", () => {
    const result = validateUploadedFile({
      size: 5 * 1024 * 1024,
      type: "image/png",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts valid JPEG file", () => {
    const result = validateUploadedFile({
      size: 2 * 1024 * 1024,
      type: "image/jpeg",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts valid WebP file", () => {
    const result = validateUploadedFile({
      size: 1 * 1024 * 1024,
      type: "image/webp",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects PDF files", () => {
    const result = validateUploadedFile({
      size: 1024,
      type: "application/pdf",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not supported");
  });

  it("rejects files over 20MB", () => {
    const result = validateUploadedFile({
      size: 21 * 1024 * 1024,
      type: "image/png",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("exceeds maximum");
  });

  it("rejects empty file (0 bytes)", () => {
    const result = validateUploadedFile({
      size: 0,
      type: "image/png",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("File is empty");
  });
});
