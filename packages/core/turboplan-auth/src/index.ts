/**
 * @wildfires-org/turboplan-auth
 *
 * Shared authentication utilities for the TurboPlan monorepo.
 *
 * This package provides:
 * - `/server` - Full server-side utilities: getSession(), verifySessionCookie(), cookie config, callbacks (requires DB)
 * - `/session` - Lightweight session utilities: getSession(), verifySessionCookie(), cookie config (no DB dependency)
 * - `/client` - Client-side utilities: SessionProvider, useSession, signIn, signOut
 * - `/types` - TypeScript types: Session, SessionUser, AuthUser, Profile
 *
 * Use `/session` instead of `/server` when you only need to verify sessions without
 * database access (e.g., landing page). Use `/server` when you need the full auth
 * infrastructure including callbacks that fetch user profiles.
 *
 * @example Server-side usage (Next.js server component)
 * ```tsx
 * import { getSession } from "@wildfires-org/turboplan-auth/server";
 *
 * export default async function Page() {
 *   const session = await getSession();
 *   if (!session) return <p>Not logged in</p>;
 *   return <p>Welcome, {session.user.email}</p>;
 * }
 * ```
 *
 * @example Lightweight session usage (no DB dependency)
 * ```tsx
 * import { getSession } from "@wildfires-org/turboplan-auth/session";
 *
 * export default async function Page() {
 *   const session = await getSession();
 *   if (!session) return <p>Not logged in</p>;
 *   return <p>Welcome, {session.user.email}</p>;
 * }
 * ```
 *
 * @example Client-side usage
 * ```tsx
 * import { useSession } from "@wildfires-org/turboplan-auth/client";
 *
 * function UserInfo() {
 *   const session = useSession();
 *   if (!session) return <p>Not logged in</p>;
 *   return <p>Welcome, {session.user.email}</p>;
 * }
 * ```
 */

// Re-export all types from the main entry point
export * from "./types";
