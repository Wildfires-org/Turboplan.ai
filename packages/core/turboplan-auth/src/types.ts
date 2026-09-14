import type { Profile } from "@wildfires-org/turboplan-db/types";

/**
 * User data from the authenticated session.
 * Contains only essential user identifiers.
 */
export type SessionUser = {
  id: string;
  email?: string;
  userRole?: string;
};

/**
 * Extended user type for NextAuth integration.
 * Includes profile data when available.
 */
export type AuthUser = SessionUser & {
  profile?: Profile | null;
};

/**
 * Session data returned by getSession and useSession.
 * Contains user identification and optional profile data.
 *
 * Returns null when user is not authenticated.
 */
export type Session = {
  user: SessionUser;
  profile: Profile | null;
} | null;

/**
 * JWT payload structure decoded from the session cookie.
 * This matches the token structure set in NextAuth's jwt callback.
 */
export type JWTPayload = {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  userRole?: string;
  sub?: string;
  iat?: number;
  exp?: number;
  jti?: string;
};

// Re-export Profile type for convenience
export type { Profile } from "@wildfires-org/turboplan-db/types";
