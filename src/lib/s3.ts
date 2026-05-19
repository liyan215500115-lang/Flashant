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
  });

  return client;
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
  });

  const uploadUrl = await getSignedUrl(await getClient(), command, {
    expiresIn: 3600,
  });

  const publicUrl = publicBaseUrl
    ? `${publicBaseUrl.replace(/\/+$/, "")}/${s3Key}`
    : uploadUrl.split("?")[0];

  return { uploadUrl, s3Key, publicUrl };
}

export async function saveFileLocally(
  file: File
): Promise<{ s3Key: string; publicUrl: string }> {
  const ext = path.extname(file.name) || ".png";
  const uniqueName = `${crypto.randomUUID()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, uniqueName), buffer);

  const s3Key = `/uploads/${uniqueName}`;
  return { s3Key, publicUrl: s3Key };
}
