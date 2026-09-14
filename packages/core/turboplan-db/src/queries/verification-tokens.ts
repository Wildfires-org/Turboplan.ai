import { createHash, randomBytes } from "crypto";
import { and, eq, lt } from "drizzle-orm";

import { db } from "../db-client";
import { verificationToken } from "../schemas";

export type TokenType = "email_verification" | "login";

// Token expiry durations
// Magic links should be short-lived for security
// Session duration (30 days) is configured separately in auth.ts
const TOKEN_EXPIRY = {
  email_verification: 15 * 60 * 1000, // 15 minutes
  login: 15 * 60 * 1000, // 15 minutes (session lasts 30 days after successful login)
} as const;

/**
 * Hash a token using SHA-256
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a secure random token
 */
function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Create a verification token for a user
 * @param userId - The user's ID
 * @param type - Token type: 'email_verification' or 'login'
 * @returns The unhashed token to send in the email
 */
export async function createVerificationToken(
  userId: string,
  type: TokenType,
): Promise<string> {
  const token = generateToken();
  const hashedToken = hashToken(token);
  const expires = new Date(Date.now() + TOKEN_EXPIRY[type]);

  // Use transaction to ensure atomic delete + insert
  await db.transaction(async (tx) => {
    // Delete any existing tokens of the same type for this user
    await tx
      .delete(verificationToken)
      .where(
        and(
          eq(verificationToken.userId, userId),
          eq(verificationToken.type, type),
        ),
      );

    // Create new token
    await tx.insert(verificationToken).values({
      userId,
      token: hashedToken,
      type,
      expires,
    });
  });

  return token;
}

/**
 * Verify a token and return the token record if valid
 * @param userId - The user's ID
 * @param token - The unhashed token from the magic link
 * @returns The token record if valid, null otherwise
 */
export async function getVerificationToken(
  userId: string,
  token: string,
): Promise<{ userId: string; type: string; expires: Date } | null> {
  const hashedToken = hashToken(token);

  const [record] = await db
    .select()
    .from(verificationToken)
    .where(
      and(
        eq(verificationToken.userId, userId),
        eq(verificationToken.token, hashedToken),
      ),
    );

  if (!record) {
    return null;
  }

  // Check if token is expired
  if (record.expires < new Date()) {
    // Clean up expired token
    await deleteVerificationToken(userId, token);
    return null;
  }

  return {
    userId: record.userId,
    type: record.type,
    expires: record.expires,
  };
}

/**
 * Atomically consume a verification token: delete it and return its record in a
 * single statement. Because the DELETE is the claim, two concurrent magic-link
 * verifications for the same token cannot both succeed (only one deletes a row),
 * closing the get-then-delete TOCTOU in the verify flow.
 *
 * @returns The token record if it existed and was unexpired, null otherwise.
 */
export async function consumeVerificationToken(
  userId: string,
  token: string,
): Promise<{ userId: string; type: string; expires: Date } | null> {
  const hashedToken = hashToken(token);

  const [record] = await db
    .delete(verificationToken)
    .where(
      and(
        eq(verificationToken.userId, userId),
        eq(verificationToken.token, hashedToken),
      ),
    )
    .returning();

  if (!record) {
    return null;
  }

  // Token existed but was already expired — treat as invalid (already removed).
  if (record.expires < new Date()) {
    return null;
  }

  return {
    userId: record.userId,
    type: record.type,
    expires: record.expires,
  };
}

/**
 * Delete a verification token after use
 * @param userId - The user's ID
 * @param token - The unhashed token
 */
export async function deleteVerificationToken(
  userId: string,
  token: string,
): Promise<void> {
  const hashedToken = hashToken(token);

  await db
    .delete(verificationToken)
    .where(
      and(
        eq(verificationToken.userId, userId),
        eq(verificationToken.token, hashedToken),
      ),
    );
}

/**
 * Delete all expired tokens (cleanup function)
 */
export async function deleteExpiredTokens(): Promise<void> {
  await db
    .delete(verificationToken)
    .where(lt(verificationToken.expires, new Date()));
}
