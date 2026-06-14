import "server-only";

import crypto from "crypto";
import path from "path";
import { writeFile, mkdir } from "fs/promises";

import type { S3Client } from "@aws-sdk/client-s3";

let client: S3Client | null = null;

export function hasS3Config(): boolean {
  return !!(
    process.env.S3_ENDPOINT &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY
  );
}

async function getClient(): Promise<S3Client> {
  if (client) return client;

  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("S3 credentials missing — use local upload instead");
  }

  // Dynamic import — never loads AWS SDK unless credentials are present
  const { S3Client: S3 } = await import("@aws-sdk/client-s3");

  client = new S3({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT!,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  return client;
}

/** Generate a pre-signed GET URL for private R2 objects — 30 day expiry */
const urlCache = new Map<string, { url: string; until: number }>();

export async function getSignedGetUrl(s3Key: string, expiresIn = 2592000): Promise<string> {
  const cached = urlCache.get(s3Key);
  if (cached && cached.until > Date.now()) return cached.url;

  const bucket = process.env.S3_BUCKET ?? "uploads";
  const [{ GetObjectCommand }, { getSignedUrl }] = await Promise.all([
    import("@aws-sdk/client-s3"),
    import("@aws-sdk/s3-request-presigner"),
  ]);

  const command = new GetObjectCommand({ Bucket: bucket, Key: s3Key });
  const url = await getSignedUrl(await getClient(), command, { expiresIn });
  urlCache.set(s3Key, { url, until: Date.now() + 600_000 }); // 10min cache
  return url;
}

export async function createUploadUrl(
  fileName: string,
  mimeType: string
): Promise<{ uploadUrl: string; s3Key: string; publicUrl: string }> {
  const bucket = process.env.S3_BUCKET ?? "uploads";
  const prefix = process.env.S3_UPLOAD_PREFIX ?? "products/";
  const publicBaseUrl = process.env.S3_PUBLIC_URL ?? "";

  const ext = fileName.includes(".") ? fileName.split(".").pop() : "png";
  const s3Key = `${prefix}${crypto.randomUUID()}.${ext}`;

  // Dynamic imports — AWS SDK never touched without full credentials
  const [{ PutObjectCommand }, { getSignedUrl }] = await Promise.all([
    import("@aws-sdk/client-s3"),
    import("@aws-sdk/s3-request-presigner"),
  ]);

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    ContentType: mimeType,
    ChecksumAlgorithm: undefined,
  });

  const uploadUrl = await getSignedUrl(await getClient(), command, {
    expiresIn: 3600,
  });

  const publicUrl = publicBaseUrl
    ? `${publicBaseUrl.replace(/\/+$/, "")}/${s3Key}`
    : uploadUrl.split("?")[0];

  return { uploadUrl, s3Key, publicUrl };
}

/** Upload a buffer to R2/S3 and return the key + URL */
export async function uploadBuffer(
  buffer: Buffer,
  mimeType: string,
  prefix?: string
): Promise<{ s3Key: string; publicUrl: string }> {
  const bucket = process.env.S3_BUCKET ?? "uploads";
  const keyPrefix = prefix ?? process.env.S3_UPLOAD_PREFIX ?? "generated/";
  const publicBaseUrl = process.env.S3_PUBLIC_URL ?? "";

  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const s3Key = `${keyPrefix}${crypto.randomUUID()}.${ext}`;

  const client = await getClient();
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const publicUrl = publicBaseUrl
    ? `${publicBaseUrl.replace(/\/+$/, "")}/${s3Key}`
    : `${process.env.S3_ENDPOINT}/${bucket}/${s3Key}`;

  return { s3Key, publicUrl };
}

/** Save a buffer locally (dev only). Throws in production. */
export async function saveBufferLocally(
  buffer: Buffer,
  mimeType: string
): Promise<{ s3Key: string; publicUrl: string }> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Local file writes are not available in production. Configure S3_* variables for Cloudflare R2 or AWS S3."
    );
  }
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const uniqueName = `${crypto.randomUUID()}.${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "generated");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, uniqueName), buffer);

  const s3Key = `/generated/${uniqueName}`;
  return { s3Key, publicUrl: s3Key };
}

export async function saveFileLocally(
  file: File
): Promise<{ s3Key: string; publicUrl: string }> {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Local file writes are not available in production. Configure S3_* environment variables for Cloudflare R2 or AWS S3."
    );
  }
  const ext = path.extname(file.name) || ".png";
  const uniqueName = `${crypto.randomUUID()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, uniqueName), buffer);

  const s3Key = `/uploads/${uniqueName}`;
  return { s3Key, publicUrl: s3Key };
}
