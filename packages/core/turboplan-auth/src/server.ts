/**
 * Server-side authentication utilities for Next.js apps.
 *
 * This module provides NextAuth configuration utilities:
 * - authCallbacks - Shared NextAuth callbacks (JWT + session with profile)
 * - createMagicLinkProvider() - Factory for magic link provider
 * - createMagicLinkLoginTicket() - Signed ticket the provider requires
 * - getCookieConfig() - Cookie configuration for cross-domain session sharing
 *
 * For session verification in Hono/non-Next.js apps, use `/hono` export.
 * For reading sessions in Next.js server components, use `/session` export.
 *
 * @module @wildfires-org/turboplan-auth/server
 */

// Cookie configuration for NextAuth
export { getCookieConfig } from "./config/cookies";
// Provider factory
export {
  createMagicLinkLoginTicket,
  createMagicLinkProvider,
} from "./config/providers";
// NextAuth callbacks
export { authCallbacks } from "./session/callbacks";
