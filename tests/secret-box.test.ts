import { afterEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

// The module reads ENCRYPTION_KEY at call time, so set it per-test.
const KEY = randomBytes(32).toString("base64");

async function fresh() {
  // Re-import to avoid the warn-once flag leaking across cases.
  return import("@/lib/crypto/secret-box");
}

describe("secret-box", () => {
  const original = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    process.env.ENCRYPTION_KEY = original;
  });

  it("round-trips a secret with a key set", async () => {
    process.env.ENCRYPTION_KEY = KEY;
    const { encryptSecret, decryptSecret, isEncrypted } = await fresh();

    const token = "EAAG-super-secret-token-12345";
    const enc = encryptSecret(token);

    expect(enc).not.toBe(token);
    expect(isEncrypted(enc)).toBe(true);
    expect(enc.startsWith("enc:v1:")).toBe(true);
    expect(decryptSecret(enc)).toBe(token);
  });

  it("produces distinct ciphertext each call (random IV)", async () => {
    process.env.ENCRYPTION_KEY = KEY;
    const { encryptSecret } = await fresh();
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("rejects tampered ciphertext (GCM auth)", async () => {
    process.env.ENCRYPTION_KEY = KEY;
    const { encryptSecret, decryptSecret } = await fresh();

    const enc = encryptSecret("token");
    const parts = enc.split(":");
    // Flip a byte in the ciphertext segment.
    const bad = Buffer.from(parts[4], "base64");
    bad[0] ^= 0xff;
    parts[4] = bad.toString("base64");

    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("passes through legacy plaintext untouched", async () => {
    process.env.ENCRYPTION_KEY = KEY;
    const { decryptSecret, isEncrypted } = await fresh();

    expect(isEncrypted("plain-token")).toBe(false);
    expect(decryptSecret("plain-token")).toBe("plain-token");
  });

  it("without a key, encrypt is a no-op and plaintext still reads", async () => {
    delete process.env.ENCRYPTION_KEY;
    const { encryptSecret, decryptSecret } = await fresh();

    expect(encryptSecret("token")).toBe("token");
    expect(decryptSecret("token")).toBe("token");
  });

  it("cannot decrypt an encrypted value once the key is removed", async () => {
    process.env.ENCRYPTION_KEY = KEY;
    const mod = await fresh();
    const enc = mod.encryptSecret("token");

    delete process.env.ENCRYPTION_KEY;
    expect(() => mod.decryptSecret(enc)).toThrow();
  });

  it("returns null for null/empty input", async () => {
    const { decryptSecret } = await fresh();
    expect(decryptSecret(null)).toBeNull();
    expect(decryptSecret(undefined)).toBeNull();
    expect(decryptSecret("")).toBeNull();
  });
});
