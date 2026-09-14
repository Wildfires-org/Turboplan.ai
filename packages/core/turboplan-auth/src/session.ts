/**
 * Session utilities for Next.js server components.
 *
 * This module provides getSession() for reading the session cookie
 * in Next.js server components. It uses next/headers internally.
 *
 * Use this in Next.js apps that need to check authentication status
 * without the full NextAuth setup (e.g., landing page).
 *
 * @module @wildfires-org/turboplan-auth/session
 */

// Session utility for Next.js server components
export { getSession } from "./session/get-session";
