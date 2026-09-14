import type { Context } from "hono";

/**
 * Handles route errors consistently across all research-agent routers.
 */
export const handleRouteError = (c: Context, label: string, error: unknown) => {
  console.error(`[${label}] Error:`, error);
  return c.json({ error: "Internal server error" }, 500);
};
