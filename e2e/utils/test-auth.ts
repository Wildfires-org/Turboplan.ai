import type { Browser } from "@playwright/test";

/**
 * Test authentication utilities for e2e tests.
 * Allows creating test users and generating magic link URLs directly
 * to bypass email sending in tests.
 */

import {
  createMagicLinkUser,
  createVerificationToken,
  getUserByEmail,
  markEmailAsVerified,
} from "@wildfires-org/turboplan-db/queries";

export interface TestUser {
  id: string;
  email: string;
}

/**
 * Create a test user with verified email and return a magic link URL
 * for authentication.
 *
 * @param email - The email for the test user
 * @param baseUrl - Base URL for the magic link (defaults to TURBOPLAN_URL env or localhost)
 * @returns Object containing user info and magic link URL
 */
export async function createTestUserWithMagicLink(
  email: string,
  baseUrl?: string,
): Promise<{
  user: TestUser;
  magicLinkUrl: string;
}> {
  const turboplanUrl =
    baseUrl || process.env.TURBOPLAN_URL || "http://localhost:3000";
  const normalizedEmail = email.trim().toLowerCase();

  // Check if user already exists
  let user = await getUserByEmail(normalizedEmail);

  if (!user) {
    // Create new user with personal organization
    const [newUser] = await createMagicLinkUser(normalizedEmail);
    user = newUser;
  }

  // Mark email as verified (skip email verification step in tests)
  await markEmailAsVerified(user.id);

  // Create a login token (used after email is verified)
  const token = await createVerificationToken(user.id, "login");

  // Build magic link URL
  const params = new URLSearchParams({
    token,
    userId: user.id,
    type: "login",
  });
  const magicLinkUrl = `${turboplanUrl}/verify?${params.toString()}`;

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    magicLinkUrl,
  };
}

/**
 * Create an unverified test user and return a verification magic link URL.
 * Use this when testing the email verification flow.
 *
 * @param email - The email for the test user
 * @param baseUrl - Base URL for the magic link
 * @returns Object containing user info and verification magic link URL
 */
export async function createUnverifiedTestUser(
  email: string,
  baseUrl?: string,
): Promise<{
  user: TestUser;
  verificationUrl: string;
}> {
  const turboplanUrl =
    baseUrl || process.env.TURBOPLAN_URL || "http://localhost:3000";
  const normalizedEmail = email.trim().toLowerCase();

  // Check if user already exists
  let user = await getUserByEmail(normalizedEmail);

  if (!user) {
    // Create new user with personal organization
    const [newUser] = await createMagicLinkUser(normalizedEmail);
    user = newUser;
  }

  // Create verification token
  const token = await createVerificationToken(user.id, "email_verification");

  // Build verification URL
  const params = new URLSearchParams({
    token,
    userId: user.id,
    type: "verification",
  });
  const verificationUrl = `${turboplanUrl}/verify?${params.toString()}`;

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    verificationUrl,
  };
}

/**
 * Opens a browser context with no cookies. `browser.newContext()` inherits the
 * project's `storageState`, so without this a "new user" context is actually
 * signed in as the default test user.
 */
export const newAnonymousContext = (browser: Browser) => {
  return browser.newContext({ storageState: { cookies: [], origins: [] } });
};
