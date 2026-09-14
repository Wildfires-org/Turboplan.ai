/**
 * Constant-time secret comparison.
 *
 * Has no Next.js, DB or NextAuth dependencies — safe to import from Hono
 * servers, workers and feature packages alike.
 *
 * @module @wildfires-org/turboplan-auth/secrets
 */

import { timingSafeEqual } from "node:crypto";

/**
 * Compares two secrets without leaking their contents through timing.
 *
 * Compares BYTE lengths, not string lengths: `timingSafeEqual` throws a
 * RangeError on unequal-length buffers (which would surface as a 500), and two
 * strings with the same char count can still differ in UTF-8 byte length when
 * either contains multibyte characters.
 *
 * The length check itself is not constant time, so this leaks the length of the
 * expected secret — unavoidable with `timingSafeEqual` and not sensitive for
 * fixed-length API keys and webhook secrets.
 */
export const timingSafeCompare = (
  received: string,
  expected: string,
): boolean => {
  const receivedBuffer = Buffer.from(received, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(receivedBuffer, expectedBuffer);
};
