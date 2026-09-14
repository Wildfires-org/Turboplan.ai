import {
  getAuthCookieDomain,
  getAuthCookieName,
} from "@wildfires-org/turboplan-env";

/**
 * Cookie options type for NextAuth cookie configuration.
 */
export type CookieOptions = {
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  secure: boolean;
  domain?: string;
};

/**
 * Build cookie options for session token.
 *
 * When AUTH_COOKIE_DOMAIN is set, cookies are scoped to that domain
 * enabling cross-subdomain session sharing (e.g. between app.example.com and
 * example.com). Scope it as narrowly as possible: every host under that domain
 * receives the session cookie on every request.
 *
 * @returns Cookie options object for NextAuth configuration
 */
export const buildCookieOptions = (): CookieOptions => {
  const authCookieDomain = getAuthCookieDomain();

  const baseOptions: CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };

  // Only add domain if AUTH_COOKIE_DOMAIN is configured
  // This enables cross-domain cookie sharing for landing page session awareness
  if (authCookieDomain) {
    return { ...baseOptions, domain: authCookieDomain };
  }

  return baseOptions;
};

/**
 * Get cookie configuration for NextAuth.
 * Returns a fresh config object each time (options are computed lazily).
 *
 * Use this in NextAuth config: cookies: { sessionToken: getCookieConfig() }
 *
 * @returns Cookie configuration object for NextAuth
 */
export const getCookieConfig = () => ({
  name: getAuthCookieName(),
  options: buildCookieOptions(),
});
