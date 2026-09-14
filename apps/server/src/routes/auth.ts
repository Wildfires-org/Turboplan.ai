import type { Context } from "hono";
import { Hono } from "hono";

import { createUploadToken } from "@wildfires-org/turboplan-api-client";

export const authRouter = new Hono();

/**
 * Generate a short-lived upload token for file uploads
 *
 * This endpoint creates a scoped JWT token specifically for file uploads:
 * - 5 minute expiry (vs 15 min for general tokens)
 * - Can only be used for /api/upload/* routes
 * - Safe to pass via query parameter
 */
authRouter.get("/upload-token", async (c: Context) => {
  try {
    // Get user from auth middleware context
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized - User not authenticated" }, 401);
    }

    // Create a short-lived upload token for the authenticated user
    const token = await createUploadToken({
      id: user.userId,
    });

    return c.json({
      token,
      user: {
        id: user.userId,
      },
    });
  } catch (error) {
    console.error("Upload token generation error:", error);
    return c.json({ error: "Failed to generate upload token" }, 500);
  }
});
