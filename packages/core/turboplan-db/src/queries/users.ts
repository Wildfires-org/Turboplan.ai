import { eq } from "drizzle-orm";

import { db } from "../db-client";
import { type User, user } from "../schemas";
// Import user creation functions from core.ts to avoid duplication
import { createUser, createUserWithProfile } from "./core";

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const [foundUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, normalizedEmail));
    return foundUser ?? null;
  } catch (error) {
    console.error("Failed to get user by email:", error);
    throw error;
  }
}

/**
 * Create a new user with their personal organization (NO profile)
 * User will need to verify email via magic link before gaining access
 * After verification, user will be redirected to profile setup flow
 *
 * This is an alias for createUser from core.ts for magic link auth flows.
 */
export const createMagicLinkUser = createUser;

/**
 * Create a new user with their personal organization AND empty profile
 * Used for self-service registration where user skips onboarding
 *
 * This is an alias for createUserWithProfile from core.ts for magic link auth flows.
 */
export const createMagicLinkUserWithProfile = createUserWithProfile;

/**
 * Mark a user's email as verified
 */
export async function markEmailAsVerified(userId: string): Promise<void> {
  try {
    await db
      .update(user)
      .set({ emailVerified: new Date() })
      .where(eq(user.id, userId));
  } catch (error) {
    console.error("Failed to mark email as verified:", error);
    throw error;
  }
}
