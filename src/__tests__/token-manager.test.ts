import { describe, it, expect, beforeAll } from "vitest";
import { encryptToken, decryptToken } from "@/lib/token-manager";

const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
});

describe("token-manager", () => {
  describe("encryptToken", () => {
    it("returns hex-encoded iv:authTag:ciphertext", () => {
      const result = encryptToken("hello world");
      const parts = result.split(":");
      expect(parts).toHaveLength(3);
      // iv = 16 bytes = 32 hex chars
      expect(parts[0]).toHaveLength(32);
      // authTag = 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32);
      // ciphertext should be non-empty hex
      expect(parts[2].length).toBeGreaterThan(0);
    });

    it("produces different output for same input (random IV)", () => {
      const a = encryptToken("test");
      const b = encryptToken("test");
      expect(a).not.toBe(b);
    });

    it("encrypts empty string", () => {
      const result = encryptToken("");
      expect(result).toContain(":");
    });

    it("encrypts unicode text", () => {
      const result = encryptToken("你好世界 🌍");
      const decrypted = decryptToken(result);
      expect(decrypted).toBe("你好世界 🌍");
    });

    it("throws when TOKEN_ENCRYPTION_KEY is not set", () => {
      const original = process.env.TOKEN_ENCRYPTION_KEY;
      delete process.env.TOKEN_ENCRYPTION_KEY;
      expect(() => encryptToken("test")).toThrow(
        "TOKEN_ENCRYPTION_KEY environment variable is not set"
      );
      process.env.TOKEN_ENCRYPTION_KEY = original;
    });
  });

  describe("decryptToken", () => {
    it("round-trips correctly", () => {
      const plaintext = "my-access-token-12345";
      const encrypted = encryptToken(plaintext);
      expect(decryptToken(encrypted)).toBe(plaintext);
    });

    it("returns null for empty input", () => {
      expect(decryptToken("")).toBeNull();
    });

    it("returns null for malformed input (not colon-separated)", () => {
      expect(decryptToken("not-valid-format")).toBeNull();
    });

    it("returns null for corrupted ciphertext", () => {
      const encrypted = encryptToken("secret");
      const corrupted = encrypted.slice(0, -4) + "dead";
      expect(decryptToken(corrupted)).toBeNull();
    });

    it("returns null for too few parts", () => {
      expect(decryptToken("abc:def")).toBeNull();
    });

    it("returns null for empty hex parts", () => {
      // 32 hex (iv) + 32 hex (authTag) but empty ciphertext
      expect(
        decryptToken(
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:"
        )
      ).toBeNull();
    });

    it("returns null for wrong IV length", () => {
      // IV is 30 hex chars instead of 32
      expect(
        decryptToken(
          "aaa:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:cc"
        )
      ).toBeNull();
    });

    it("returns null for wrong auth tag length", () => {
      // AuthTag is 30 hex chars instead of 32
      const iv = "a".repeat(32);
      const shortTag = "b".repeat(30);
      expect(decryptToken(`${iv}:${shortTag}:cc`)).toBeNull();
    });
  });
});
