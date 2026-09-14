"use client";

/**
 * Client-side authentication utilities.
 *
 * This module provides React components and hooks for authentication:
 * - SessionProvider: Context provider to pass session to client components
 * - useSession: Hook to access the current session
 * - signIn, signOut: NextAuth functions for authentication flows
 *
 * @module @wildfires-org/turboplan-auth/client
 */

import { createContext, type ReactNode, useContext } from "react";

import type { Session } from "./types";

// Re-export next-auth/react utilities for convenience
export { signIn, signOut } from "next-auth/react";

/**
 * Internal context type that wraps the session.
 * Using an object wrapper allows distinguishing between
 * "provider not present" (null context) vs "no session" (null session).
 */
type SessionContextValue = {
  session: Session;
};

const SessionContext = createContext<SessionContextValue | null>(null);

type SessionProviderProps = {
  children: ReactNode;
  session: Session;
};

/**
 * Provider component that makes session available to child components.
 * Wrap your app or layout with this provider to enable useSession hook.
 *
 * @param props.session - The session object from getSession(), or null if unauthenticated
 * @param props.children - Child components that will have access to the session
 *
 * @example
 * ```tsx
 * // In layout.tsx (Server Component)
 * import { SessionProvider } from "@wildfires-org/turboplan-auth/client";
 * import { getSession } from "@wildfires-org/turboplan-auth/server";
 *
 * export default async function RootLayout({ children }) {
 *   const session = await getSession();
 *   return (
 *     <html>
 *       <body>
 *         <SessionProvider session={session}>
 *           {children}
 *         </SessionProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export const SessionProvider = ({
  children,
  session,
}: SessionProviderProps) => {
  return (
    <SessionContext.Provider value={{ session }}>
      {children}
    </SessionContext.Provider>
  );
};

/**
 * Hook to access the current session in client components.
 * Must be used within a SessionProvider.
 *
 * @returns The current session object, or null if not authenticated
 *
 * @example
 * ```tsx
 * "use client";
 * import { useSession } from "@wildfires-org/turboplan-auth/client";
 *
 * function UserMenu() {
 *   const session = useSession();
 *
 *   if (!session) {
 *     return <button>Sign In</button>;
 *   }
 *
 *   return (
 *     <div>
 *       <span>Welcome, {session.profile?.firstName ?? session.user.email}</span>
 *       <button>Sign Out</button>
 *     </div>
 *   );
 * }
 * ```
 */
export const useSession = (): Session => {
  const context = useContext(SessionContext);
  return context?.session ?? null;
};
