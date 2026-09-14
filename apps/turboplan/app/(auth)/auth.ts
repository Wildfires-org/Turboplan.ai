import NextAuth from "next-auth";

import {
  authCallbacks,
  createMagicLinkProvider,
  getCookieConfig,
} from "@wildfires-org/turboplan-auth/server";
import { getWebEnv } from "@wildfires-org/turboplan-env";

import { aliasEmailIdentity, captureServerEvent } from "@/lib/server-analytics";
import { authConfig } from "./auth.config";

const toOrigin = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

/**
 * NextAuth only follows same-origin redirects by default. The landing page
 * signs users out via `/logout?callbackUrl=<landing>`, so allow that origin
 * too. Note this callback is global: sign-in `callbackUrl`s pointing at the
 * landing page are honoured as well, which is intended.
 */
const isAllowedRedirect = (url: string, baseUrl: string): boolean => {
  const target = toOrigin(url);
  if (!target) {
    return false;
  }
  // A malformed LANDING_URL must degrade to "same-origin only", not throw —
  // this runs on every sign-in/sign-out.
  return [baseUrl, getWebEnv().LANDING_URL].map(toOrigin).includes(target);
};

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  events: {
    // Signup is captured at user creation in the login server action — the
    // Credentials-based magic-link provider never sets isNewUser here.
    async signIn({ user }) {
      if (user.id) {
        captureServerEvent(user.id, "user_logged_in");
        if (user.email) {
          // Merge the pre-login magic-link identity into this user's profile
          await aliasEmailIdentity(user.id, user.email);
        }
      }
    },
  },
  // Session cookie expires after 30 days (1 month)
  // Note: Magic links expire in 15 minutes, this is the session duration after successful login
  session: {
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  },
  // Custom cookie configuration for cross-domain session sharing
  cookies: {
    sessionToken: getCookieConfig(),
  },
  providers: [createMagicLinkProvider()],
  callbacks: {
    ...authConfig.callbacks,
    ...authCallbacks,
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      return isAllowedRedirect(url, baseUrl) ? url : baseUrl;
    },
  },
});
