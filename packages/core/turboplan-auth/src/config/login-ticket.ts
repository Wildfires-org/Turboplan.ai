/**
 * Short-lived signed login tickets for the magic-link Credentials provider.
 *
 * The NextAuth callback endpoint for a Credentials provider is publicly
 * reachable, so `authorize()` must never trust a bare userId. Server code that
 * has ALREADY proven the user's identity (magic-link verification, invitation
 * acceptance) mints a ticket and hands it to `signIn("magic-link", { ticket })`
 * in-process; `authorize()` accepts only a ticket carrying a valid HMAC made
 * with a key derived from AUTH_SECRET, the login purpose and an unexpired `exp`.
 *
 * Format: `base64url(JSON payload).base64url(HMAC-SHA256)`.
 *
 * No Next.js, DB or NextAuth imports, so it is unit-testable in isolation.
 */

import { createHmac, randomUUID } from "node:crypto";

import { timingSafeCompare } from "../secrets";

export const LOGIN_TICKET_PURPOSE = "magic-link-login";
export const LOGIN_TICKET_TTL_SECONDS = 60;

// Domain separation: the ticket key must never equal the raw AUTH_SECRET that
// NextAuth also uses, so a value signed for one purpose cannot verify as another.
const KEY_DERIVATION_LABEL = "turboplan-auth:login-ticket:v1";

type LoginTicketPayload = {
  sub: string;
  purpose: string;
  jti: string;
  iat: number;
  exp: number;
};

type TicketUser = {
  id: string;
  email: string;
};

const deriveKey = (secret: string) => {
  return createHmac("sha256", secret).update(KEY_DERIVATION_LABEL).digest();
};

const signPayload = (encodedPayload: string, secret: string) => {
  return createHmac("sha256", deriveKey(secret))
    .update(encodedPayload)
    .digest("base64url");
};

const toSeconds = (ms: number) => Math.floor(ms / 1000);

const isPayload = (value: unknown): value is LoginTicketPayload => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.sub === "string" &&
    payload.sub.length > 0 &&
    typeof payload.purpose === "string" &&
    typeof payload.jti === "string" &&
    typeof payload.iat === "number" &&
    typeof payload.exp === "number"
  );
};

/**
 * Mints a login ticket for a user whose identity the caller has already
 * verified. Only call this AFTER validating a magic-link or invitation token.
 */
export const createLoginTicket = (
  userId: string,
  secret: string,
  now: number = Date.now(),
): string => {
  if (!userId) {
    throw new Error("createLoginTicket: userId is required");
  }
  if (!secret) {
    throw new Error("createLoginTicket: secret is required");
  }

  const iat = toSeconds(now);
  const payload: LoginTicketPayload = {
    sub: userId,
    purpose: LOGIN_TICKET_PURPOSE,
    jti: randomUUID(),
    iat,
    exp: iat + LOGIN_TICKET_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );

  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
};

/**
 * Returns the ticket's userId when signature, purpose and expiry are all
 * valid; `null` otherwise. Never throws on malformed input.
 */
export const verifyLoginTicket = (
  ticket: unknown,
  secret: string,
  now: number = Date.now(),
): string | null => {
  if (typeof ticket !== "string" || !secret) {
    return null;
  }

  const parts = ticket.split(".");
  if (parts.length !== 2) {
    return null;
  }
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) {
    return null;
  }

  if (!timingSafeCompare(signature, signPayload(encodedPayload, secret))) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    );
  } catch {
    return null;
  }

  if (!isPayload(payload)) {
    return null;
  }
  if (payload.purpose !== LOGIN_TICKET_PURPOSE) {
    return null;
  }
  if (payload.exp <= toSeconds(now)) {
    return null;
  }

  return payload.sub;
};

/**
 * `authorize()` logic for the magic-link provider: resolves the user named by
 * a valid ticket. Any other credential shape (e.g. a bare `userId`) is refused.
 */
export const authorizeLoginTicket = async (
  credentials: Partial<Record<string, unknown>> | undefined,
  secret: string,
  findUserById: (userId: string) => Promise<TicketUser | null | undefined>,
): Promise<TicketUser | null> => {
  const userId = verifyLoginTicket(credentials?.ticket, secret);
  if (!userId) {
    return null;
  }

  const user = await findUserById(userId);
  if (!user) {
    return null;
  }

  return { id: user.id, email: user.email };
};
