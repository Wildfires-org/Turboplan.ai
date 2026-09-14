/**
 * Keyed (HMAC-SHA256) pseudonymous email identity for analytics.
 *
 * The API server captures pre-login events (e.g. magic_link_requested) under
 * `email:<hmacEmailId(email, AUTH_SECRET)>`, and the web app derives the same
 * id at login to alias it onto the real user id so the signup funnel joins.
 *
 * CONTRACT: `AUTH_SECRET` must be byte-identical across the API server and
 * the web app — the two services derive this id independently, and a secret
 * mismatch breaks the funnel join silently. Both sides import THIS function
 * (never reimplement it); the known-answer test in
 * `apps/server/unit-tests/email-identity-contract.test.ts` pins the output.
 *
 * Unlike a bare sha256, a keyed HMAC prevents an analytics viewer with a
 * list of candidate emails from recomputing and matching ids.
 *
 * Web Crypto only — runs unchanged in Node, workerd, and edge runtimes.
 */
export const hmacEmailId = async (
  email: string,
  secret: string,
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(email.toLowerCase().trim()),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};
