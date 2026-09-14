import type { NextAuthConfig } from "next-auth";

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

      // Define public routes that don't require authentication
      const publicRoutes = [
        "/login",
        "/register",
        "/self-service",
        "/verify",
        "/check-email",
        "/logout",
      ];
      const isOnPublicRoute = publicRoutes.some((route) =>
        nextUrl.pathname.startsWith(route),
      );

      // Dashboard is now at root - any route not in the public list requires authentication
      const requiresAuthentication = !isOnPublicRoute;

      const isOnRegister = nextUrl.pathname.startsWith("/register");
      const isOnLogin = nextUrl.pathname.startsWith("/login");
      const isOnSetup = nextUrl.pathname.startsWith("/setup");
      const isOnSelfService = nextUrl.pathname.startsWith("/self-service");
      const isOnVerify = nextUrl.pathname.startsWith("/verify");
      const isOnCheckEmail = nextUrl.pathname.startsWith("/check-email");
      const isOnLogout = nextUrl.pathname.startsWith("/logout");

      // Redirect logged-in users away from auth pages (except verify which handles sign-in)
      if (isLoggedIn && (isOnLogin || isOnRegister || isOnCheckEmail)) {
        return Response.redirect(new URL("/", nextUrl as unknown as URL));
      }

      // Allow access to auth pages for unauthenticated users
      if (
        isOnRegister ||
        isOnLogin ||
        isOnSelfService ||
        isOnVerify ||
        isOnCheckEmail ||
        isOnLogout
      ) {
        return true;
      }

      // Always allow access to setup for logged in users
      if (isOnSetup) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      }

      // For protected routes, we need to check authentication
      // The profile completion check will be handled by middleware
      if (requiresAuthentication) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
