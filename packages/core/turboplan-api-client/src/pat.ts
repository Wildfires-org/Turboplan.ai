import { createHash, randomBytes } from "crypto";

const PAT_PREFIX = "tc_pat_";
const BASE62_CHARS =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const UNBIASED_THRESHOLD = 248;

const randomBase62 = (length: number): string => {
  let result = "";
  while (result.length < length) {
    const bytes = randomBytes(length - result.length + 8);
    for (const byte of bytes) {
      if (byte < UNBIASED_THRESHOLD) {
        result += BASE62_CHARS[byte % 62];
        if (result.length >= length) {
          break;
        }
      }
    }
  }
  return result;
};

export const generatePAT = (): {
  plaintext: string;
  hash: string;
  prefix: string;
} => {
  const encoded = randomBase62(30);
  const plaintext = `${PAT_PREFIX}${encoded}`;
  const hash = hashPAT(plaintext);
  const prefix = plaintext.slice(0, 12);
  return { plaintext, hash, prefix };
};

export const hashPAT = (plaintext: string): string => {
  return createHash("sha256").update(plaintext).digest("hex");
};

export const isPATToken = (token: string): boolean => {
  return token.startsWith(PAT_PREFIX);
};
