/**
 * Unique, unguessable final key segment for a stored object:
 * `{timestamp}-{uuid}-{name}`.
 *
 * Objects are served from permanent public URLs, so the key is the only thing
 * standing between a private file and anyone who can enumerate it. A timestamp
 * alone is brute-forceable; the full 122-bit UUID is not. The timestamp prefix
 * stays so existing display-name derivation that strips `^\d+-` keeps working.
 * Uses Web Crypto so it runs in both Node and Cloudflare Workers.
 */
export const uniqueStorageName = (name: string): string => {
  return `${Date.now()}-${globalThis.crypto.randomUUID()}-${name}`;
};
