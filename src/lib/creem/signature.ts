import "server-only";

import crypto from "crypto";

/** HMAC-SHA256 of the raw body, hex, compared to the creem-signature header. */
export function verifyCreemSignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined
): boolean {
  if (!signature || !secret) return false;

  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const actual = Buffer.from(digest);
  const expected = Buffer.from(signature.trim());
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
