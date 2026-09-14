import { decode } from "@auth/core/jwt";
import { cookies } from "next/headers";

import { getAuthCookieName } from "@wildfires-org/turboplan-env";

import type { JWTPayload, Profile, Session } from "../types";

/**
 * Get the current session from the turboplan session cookie.
 *
 * This function reads the session cookie and decodes it using the shared AUTH_SECRET.
 * Use this in Next.js server components to get the authenticated user's information.
 *
 * Profile data (firstName, lastName, avatarUrl) is read from the JWT token,
 * which is populated by the NextAuth jwt callback at sign-in time.
 *
 * Requires AUTH_SECRET environment variable to be set.
 *
 * @returns The session with user data, or null if not authenticated
 *
 * @example
 * ```tsx
 * // In a server component
 * import { getSession } from "@wildfires-org/turboplan-auth/server";
 *
 * export default async function Page() {
 *   const session = await getSession();
 *
 *   if (!session) {
 *     return <p>Not logged in</p>;
 *   }
 *
 *   return <p>Welcome, {session.user.email}</p>;
 * }
 * ```
 */
export const getSession = async (): Promise<Session> => {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(getAuthCookieName())?.value;

    if (!sessionToken) {
      return null;
    }

    // Access AUTH_SECRET directly to avoid requiring all env vars from turboplan-env
    // This allows the function to work in both turboplan and landing-page contexts
    const AUTH_SECRET = process.env.AUTH_SECRET;

    if (!AUTH_SECRET) {
      console.error("AUTH_SECRET environment variable is not set");
      return null;
    }

    // Decode the JWT using the same secret as turboplan
    const decoded = await decode<JWTPayload>({
      token: sessionToken,
      secret: AUTH_SECRET,
      // Salt must match what NextAuth uses for the session token
      // NextAuth v5 uses the cookie name as salt by default
      salt: getAuthCookieName(),
    });

    if (!decoded) {
      return null;
    }

    // Check if token is expired
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return null;
    }

    // Extract user data from the decoded token
    // The id is set in turboplan's jwt callback
    const userId = decoded.id || decoded.sub;

    if (!userId) {
      return null;
    }

    // Build profile from JWT fields (populated at sign-in by the jwt callback)
    const hasProfileData =
      decoded.firstName || decoded.lastName || decoded.avatarUrl;

    return {
      user: {
        id: userId,
        email: decoded.email,
      },
      profile: hasProfileData
        ? ({
            firstName: decoded.firstName ?? null,
            lastName: decoded.lastName ?? null,
            avatarUrl: decoded.avatarUrl ?? null,
          } as Partial<Profile> as Profile)
        : null,
    };
  } catch (error) {
    // Log error in development, silently fail in production
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to decode session:", error);
    }
    return null;
  }
};
