/**
 * Hono-compatible authentication utilities.
 *
 * This module provides session verification for non-Next.js contexts
 * like Hono servers running on Bun. It has NO Next.js dependencies.
 *
 * Use this in:
 * - Hono API servers (apps/server)
 * - Any Node.js/Bun backend that doesn't use Next.js
 *
 * @module @wildfires-org/turboplan-auth/hono
 */

// Session verification (no Next.js dependencies)
export { verifySessionCookie } from "./session/verify-session-cookie";
