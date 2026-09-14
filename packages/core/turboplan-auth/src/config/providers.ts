import Credentials from "next-auth/providers/credentials";

import { getUserById } from "@wildfires-org/turboplan-db/queries";

/**
 * Factory function to create the magic link credentials provider.
 *
 * This provider authenticates by userId after the magic link token
 * has been verified externally (in verifyMagicLink action).
 *
 * @returns NextAuth Credentials provider configured for magic link auth
 *
 * @example
 * ```typescript
 * // In your NextAuth config
 * import { createMagicLinkProvider } from "@wildfires-org/turboplan-auth/server";
 *
 * export const { handlers, auth, signIn, signOut } = NextAuth({
 *   providers: [createMagicLinkProvider()],
 *   // ...
 * });
 * ```
 */
export const createMagicLinkProvider = () => {
  return Credentials({
    id: "magic-link",
    name: "Magic Link",
    credentials: {
      userId: { type: "text" },
    },
    async authorize(credentials) {
      const { userId } = credentials as { userId: string };

      if (!userId) return null;

      // Get user by ID (token already validated in verifyMagicLink action)
      const user = await getUserById(userId);
      if (!user) return null;

      // Return user object for session
      return {
        id: user.id,
        email: user.email,
      };
    },
  });
};
