/**
 * Server-only symmetric encryption for secrets stored at rest (e.g. per-org
 * third-party API keys). Keyed off ENCRYPTION_KEY, a dedicated secret so that
 * a leak of the session or token secrets does not expose data at rest.
 *
 * Lives in its own entry point (`@wildfires-org/turboplan-env/crypto`) instead
 * of the package barrel so that `node:crypto` is never pulled into client
 * bundles that import the main env module.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
// Marks a value produced by encryptSecret. Anything without it is treated as
// legacy plaintext, so values written before encryption was introduced keep
// working until they are next saved.
const PREFIX = "enc:v1:";

const deriveKey = (): Buffer => {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "Missing `ENCRYPTION_KEY` env variable (required for secret encryption)",
    );
  }
  // Fixed salt: ENCRYPTION_KEY is already high-entropy, and a stored random salt
  // would have to live alongside the ciphertext for no added protection here.
  return scryptSync(secret, "turboplan-secret-crypto", KEY_LENGTH);
};

export const encryptSecret = (plaintext: string): string => {
  const key = deriveKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
};

export const isEncrypted = (value: string): boolean => value.startsWith(PREFIX);

export const decryptSecret = (value: string): string => {
  // Backward compatibility: plaintext values written before encryption was
  // introduced are returned unchanged.
  if (!isEncrypted(value)) {
    return value;
  }

  const [ivHex, authTagHex, encryptedHex] = value
    .slice(PREFIX.length)
    .split(":");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Malformed encrypted secret");
  }

  const key = deriveKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
};
