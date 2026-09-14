import type { Session } from "next-auth";

// Re-export auth types from shared package
export type { AuthUser, Profile } from "@wildfires-org/turboplan-auth/types";

// Import for use in AuthSession
import type { AuthUser } from "@wildfires-org/turboplan-auth/types";

/**
 * Extended session type with AuthUser.
 * Kept for backward compatibility with existing code.
 */
export interface AuthSession extends Session {
  user: AuthUser;
}
