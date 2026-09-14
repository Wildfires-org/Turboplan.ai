import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

import { getProfileByUserId } from "@wildfires-org/turboplan-db/queries";

import type { AuthUser } from "../types";

/**
 * Shared NextAuth callbacks for JWT and session handling.
 *
 * These callbacks:
 * - Store user ID in the JWT token
 * - Fetch and attach user profile to the session
 *
 * @example
 * ```typescript
 * import { authCallbacks } from "@wildfires-org/turboplan-auth/server";
 *
 * export const { handlers, auth } = NextAuth({
 *   callbacks: authCallbacks,
 *   // ...
 * });
 * ```
 */
export const authCallbacks = {
  /**
   * JWT callback - called when JWT is created or updated.
   * Stores the user ID and profile data in the token.
   */
  async jwt({ token, user }: { token: JWT; user?: User }) {
    if (user) {
      token.id = user.id;

      // Store profile fields in JWT so they're available without DB access
      try {
        const profile = await getProfileByUserId(user.id as string);
        if (profile) {
          token.firstName = profile.firstName ?? undefined;
          token.lastName = profile.lastName ?? undefined;
          token.avatarUrl = profile.avatarUrl ?? undefined;
          token.userRole = profile.userRole ?? undefined;
        }
      } catch {
        // Profile fetch failure is non-critical for JWT creation
      }
    }
    return token;
  },

  /**
   * Session callback - called when session is accessed.
   * Attaches user ID and profile to the session.
   */
  async session({ session, token }: { session: Session; token: JWT }) {
    if (session.user) {
      const authUser = session.user as AuthUser;
      authUser.id = token.id as string;

      // Add profile to session
      try {
        authUser.profile = await getProfileByUserId(token.id as string);
      } catch (error) {
        console.error("Failed to fetch user profile for session:", error);
        authUser.profile = null;
      }
    }

    return session;
  },
};
