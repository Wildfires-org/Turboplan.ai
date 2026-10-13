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

      if (isOnAnyRoute(PUBLIC_ROUTES)) {
        return true;
      }

      // Everything else, `/setup` and the dashboard at the root included,
      // needs a session; returning false redirects to the login page. The
      // profile completion check is handled by middleware.
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
