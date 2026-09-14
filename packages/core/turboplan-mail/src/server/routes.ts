import { timingSafeEqual } from "crypto";
import { Hono } from "hono";
import { z } from "zod";

import { getApiEnv } from "@wildfires-org/turboplan-env";

import type { MagicLinkType } from "../templates";
import { getMailService } from "./mail-instance";

// Router for authenticated email operations (if needed in future)
export const emailRouter = new Hono();

// Router for internal email operations (magic links)
// Protected by INTERNAL_API_SECRET header validation
export const internalEmailRouter = new Hono();

const INTERNAL_SECRET_HEADER = "X-Internal-Secret";

/**
 * Validate internal secret using timing-safe comparison
 * to prevent timing attacks
 */
function validateInternalSecret(headerValue: string | undefined): boolean {
  const secret = getApiEnv().INTERNAL_API_SECRET;
  if (!secret || !headerValue) return false;

  try {
    const expected = Buffer.from(secret);
    const received = Buffer.from(headerValue);
    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  } catch {
    return false;
  }
}

// Middleware to validate internal secret on all routes
internalEmailRouter.use("*", async (c, next) => {
  const secret = c.req.header(INTERNAL_SECRET_HEADER);
  if (!validateInternalSecret(secret)) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  await next();
});

const sendMagicLinkSchema = z.object({
  to: z.string().email(),
  magicLinkUrl: z.string().url(),
  type: z.enum(["verification", "login"]),
});

/**
 * POST /internal/auth/magic-link
 * Internal endpoint for sending magic link emails
 * Called from Next.js server actions for registration/login
 */
internalEmailRouter.post("/magic-link", async (c) => {
  try {
    const body = await c.req.json();
    const validated = sendMagicLinkSchema.parse(body);

    // Restrict the magic-link host to the app's own origin. Without this, a
    // holder of the internal secret could send convincing "sign in to <App>"
    // emails whose link points at an attacker-controlled host (phishing).
    const allowedOrigin = new URL(getApiEnv().TURBOPLAN_URL).origin;
    let linkOrigin: string;
    try {
      linkOrigin = new URL(validated.magicLinkUrl).origin;
    } catch {
      return c.json({ success: false, error: "Invalid magicLinkUrl" }, 400);
    }
    if (linkOrigin !== allowedOrigin) {
      return c.json(
        { success: false, error: "magicLinkUrl host is not allowed" },
        400,
      );
    }

    const mailService = getMailService();
    const result = await mailService.sendMagicLinkEmail({
      to: validated.to,
      magicLinkUrl: validated.magicLinkUrl,
      type: validated.type as MagicLinkType,
    });

    if (result.success) {
      return c.json({ success: true, messageId: result.messageId });
    } else {
      console.error(
        "[Email] Mail provider returned error for magic link:",
        result.error,
      );
      return c.json({ success: false, error: result.error }, 500);
    }
  } catch (error) {
    console.error("[Email] Failed to send magic link email:", error);

    if (error instanceof z.ZodError) {
      return c.json(
        {
          success: false,
          error: "Invalid request data",
          details: error.issues,
        },
        400,
      );
    }

    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send email",
      },
      500,
    );
  }
});
