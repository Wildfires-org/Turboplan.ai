/**
 * Object keys the server reads or writes with the bucket's credentials.
 * Client-safe: shared by the storage client (`getObjectBytes`) and the
 * letterhead grid schema (`isGridLogoKey`), which loads in the browser too.
 */

/** R2 and S3 keys are at most 1024 bytes; no key we write comes close. */
export const MAX_OBJECT_KEY_CHARS = 1024;

// Control characters (C0, DEL, C1), lone surrogates and the backslash never
// appear in a key we write, so their presence means the key was crafted.
const UNSAFE_OBJECT_KEY_CHARS = /[\p{Cc}\p{Cs}\\]/u;

/**
 * Whether `key` names exactly one object inside the bucket: non-empty, at
 * most {@link MAX_OBJECT_KEY_CHARS}, no control character, lone surrogate or
 * backslash, and every `/` segment non-empty and neither `.` nor `..` (so no
 * leading slash either). The S3 client puts the key into the request path
 * as is, where a dot-segment would be resolved by the HTTP layer and name
 * another path of the account (`../other-bucket/x.png`).
 */
export const isSafeObjectKey = (key: string): boolean =>
  typeof key === "string" &&
  key.length > 0 &&
  key.length <= MAX_OBJECT_KEY_CHARS &&
  !UNSAFE_OBJECT_KEY_CHARS.test(key) &&
  key
    .split("/")
    .every((segment) => segment !== "" && segment !== "." && segment !== "..");
