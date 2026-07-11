import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

// Authenticated encryption (AES-256-GCM) for secrets stored at rest —
// Meta/WhatsApp access tokens today, OAuth tokens later. The key comes from
// ENCRYPTION_KEY (32 bytes, base64 or hex). Ciphertext is self-describing:
//   enc:v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>
// Values without that prefix are treated as legacy plaintext, so enabling
// the key doesn't break existing rows — they get re-encrypted on next write.

const PREFIX = "enc:v1:";

function loadKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY?.trim();

  if (!raw) {
    return null;
  }

  // Accept base64 or hex; must decode to exactly 32 bytes.
  const asBase64 = Buffer.from(raw, "base64");
  if (asBase64.length === 32) {
    return asBase64;
  }

  const asHex = Buffer.from(raw, "hex");
  if (asHex.length === 32) {
    return asHex;
  }

  throw new Error(
    "ENCRYPTION_KEY must decode to 32 bytes (base64 or hex). Generate: openssl rand -base64 32",
  );
}

export function hasEncryptionKey(): boolean {
  return Boolean(process.env.ENCRYPTION_KEY?.trim());
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

// Encrypts when a key is configured; otherwise returns plaintext unchanged
// (local dev without the key still works — a warning is logged once).
export function encryptSecret(plaintext: string): string {
  const key = loadKey();

  if (!key) {
    warnOnce();
    return plaintext;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

// Decrypts enc:v1 values; passes through legacy plaintext untouched.
export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (!isEncrypted(value)) {
    return value; // legacy plaintext
  }

  const key = loadKey();

  if (!key) {
    throw new Error(
      "Value is encrypted but ENCRYPTION_KEY is not set — cannot decrypt.",
    );
  }

  const [iv, authTag, ciphertext] = value.slice(PREFIX.length).split(":");

  if (!iv || !authTag || !ciphertext) {
    throw new Error("Malformed encrypted value.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

let warned = false;
function warnOnce() {
  if (!warned) {
    warned = true;
    console.warn(
      "[secret-box] ENCRYPTION_KEY not set — access tokens stored as plaintext. Set it before production.",
    );
  }
}
