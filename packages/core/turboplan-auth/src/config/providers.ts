import Credentials from "next-auth/providers/credentials";

import { getUserById } from "@wildfires-org/turboplan-db/queries";
import { getCommonEnv } from "@wildfires-org/turboplan-env";

import { authorizeLoginTicket, createLoginTicket } from "./login-ticket";

/**
 * Mints a login ticket for the magic-link provider. Call ONLY after the user's
 * identity has been proven (magic-link token or invitation token validated),
 * and pass the result straight to the in-process `signIn()` — never send it to
 * the browser.
 */
export const createMagicLinkLoginTicket = (userId: string): string => {
  return createLoginTicket(userId, getCommonEnv().AUTH_SECRET);
};

/**
 * Factory function to create the magic link credentials provider.
 *
 * The provider's callback endpoint is publicly reachable, so it accepts ONLY a
 * short-lived signed login ticket (see `createMagicLinkLoginTicket`), minted
 * by server code after it has validated a magic-link or invitation token. A
 * bare userId is refused.
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
 *
 * // In a server action, after validating the magic-link token
 * await signIn("magic-link", {
 *   ticket: createMagicLinkLoginTicket(user.id),
 *   redirect: false,
 * });
 * ```
 */
export const createMagicLinkProvider = () => {
  return Credentials({
    id: "magic-link",
    name: "Magic Link",
    credentials: {
      ticket: { type: "text" },
    },
    authorize: (credentials) => {
      return authorizeLoginTicket(
        credentials,
        getCommonEnv().AUTH_SECRET,
        getUserById,
      );
    },
  });
};
