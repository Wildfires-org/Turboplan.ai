import type { NextAuthConfig } from "next-auth";

/**
 * Segment-aware route match: `/login` and `/login/x`, never `/login-team`.
 * Org slugs live at the URL root (`/:org`), so a bare `startsWith` would treat
 * an org like `registered-agents` as `/register`. Pure string logic, so it is
 * safe in the Edge middleware this file runs in.
 */
export const isOnRoute = (pathname: string, route: string): boolean => {
  return pathname === route || pathname.startsWith(`${route}/`);
};

// Reachable without a session.
const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/self-service",
  "/verify",
  "/check-email",
  "/logout",
];

// Logged-in users are sent home from these (verify handles sign-in itself).
const LOGGED_OUT_ONLY_ROUTES = ["/login", "/register", "/check-email"];

// The middleware guards pages only. API routes answer 401 themselves, the
// Sentry tunnel reports errors from signed-out pages, and an invitation is
// accepted before the invitee has an account.
const UNGUARDED_ROUTES = ["/api", "/monitoring", "/invite"];

// Files served from `public/` (`/brand/logo.svg`); slugs never contain a dot.
const isStaticFile = (pathname: string) => {
  return /\/[^/]+\.[^/]+$/.test(pathname);
};

/**
 * Sends a signed-out visitor to login, keeping where they were going as a
 * relative `callbackUrl` (the login form drops absolute ones).
 */
const redirectToLogin = (nextUrl: URL) => {
  const loginUrl = new URL("/login", nextUrl);
  if (nextUrl.pathname !== "/") {
    loginUrl.searchParams.set(
      "callbackUrl",
      `${nextUrl.pathname}${nextUrl.search}`,
    );
  }
  return Response.redirect(loginUrl);
};

export const authConfig = {
  pages: {
    signIn: "/login",
    newUser: "/setup/personal",
  },
  providers: [
    // added later in auth.ts since it requires bcrypt which is only compatible with Node.js
    // while this file is also used in non-Node.js environments
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;
      const isOnAnyRoute = (routes: string[]) => {
        return routes.some((route) => isOnRoute(pathname, route));
      };

      if (isLoggedIn && isOnAnyRoute(LOGGED_OUT_ONLY_ROUTES)) {
        return Response.redirect(new URL("/", nextUrl as unknown as URL));
      }

      if (
        isOnAnyRoute(PUBLIC_ROUTES) ||
        isOnAnyRoute(UNGUARDED_ROUTES) ||
        isStaticFile(pathname)
      ) {
        return true;
      }

      // Everything else, `/setup` and the dashboard at the root included,
      // needs a session. Return the redirect rather than `false`: next-auth
      // ignores `false` when the middleware passes its own handler to
      // `auth()`, as middleware.ts does. The profile completion check is
      // handled by middleware.
      if (!isLoggedIn) {
        return redirectToLogin(nextUrl as unknown as URL);
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
