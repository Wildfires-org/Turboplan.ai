import type { Context } from "hono";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { generateObject, getModel } from "@wildfires-org/turboplan-ai/server";
import {
  gateCreditsOr402,
  meterAiCall,
} from "@wildfires-org/turboplan-billing/server";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  NO_PERMISSION_REASON,
  type RBACContext,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";
import { createRateLimiter } from "@wildfires-org/turboplan-utils/server";
import { getOfficeById } from "@wildfires-org/turboplan-workspace/server";

import {
  buildLetterheadExtractPrompt,
  decodeLetterheadImage,
  getModelVisibleSize,
  type ImageSize,
  type LetterheadExtraction,
  type LetterheadImageMimeType,
  letterheadExtractRequestSchema,
  letterheadModelOutputSchema,
  MAX_LETTERHEAD_BODY_BYTES,
  normalizeLetterheadExtraction,
} from "../utils/letterhead-extract.js";

const ROUTE_NAME = "letterhead-import";
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_OUTPUT_TOKENS = 1_000;

// Per-user, per-isolate (see createRateLimiter). Vision calls are the most
// expensive thing a settings page can trigger, so keep it tight.
const isWithinUserLimit = createRateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
});

const forbidden = (c: Context<RBACContext>) =>
  c.json({ error: "Forbidden", reason: NO_PERMISSION_REASON }, 403);

/**
 * Ask the vision model to read the letterhead in `bytes`. Returns the
 * normalized extraction plus the raw generation (for metering). Exported so it
 * can be exercised directly against a real image.
 */
export const extractLetterheadFromImage = async ({
  bytes,
  mimeType,
  size,
}: {
  bytes: Uint8Array;
  mimeType: LetterheadImageMimeType;
  size: ImageSize;
}) => {
  // Primary slot (default anthropic/claude-sonnet-4.6, image-capable). The
  // lite slot (Haiku 4.5) reads the text but places the logo box and header
  // edge poorly and keeps small caps as ALL CAPS.
  const model = await getModel("primary");
  const visibleSize = getModelVisibleSize(size);
  const generation = await generateObject({
    model,
    schema: letterheadModelOutputSchema,
    system: buildLetterheadExtractPrompt(visibleSize),
    messages: [
      {
        role: "user",
        content: [
          { type: "image", image: bytes, mediaType: mimeType },
          {
            type: "text",
            text: "Extract the letterhead from this image.",
          },
        ],
      },
    ],
    temperature: 0,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  return {
    extraction: normalizeLetterheadExtraction(generation.object, visibleSize),
    generation,
  };
};

// Who may run an import: whoever may save the letterhead it prefills — UPDATE
// on the office when one is named (and it must belong to the organization
// being billed), else UPDATE on the organization. Unknown entities answer the
// same 403 as a denial.
const authorize = async (
  c: Context<RBACContext>,
  organizationId: string,
  officeId: string | undefined,
): Promise<Response | null> => {
  if (!officeId) {
    const check = requirePermission(
      EntityType.ORGANIZATION,
      Action.UPDATE,
      () => organizationId,
    );
    return (await check(c, async () => {})) ?? null;
  }

  const office = await getOfficeById(officeId);
  if (!office || office.organizationId !== organizationId) {
    return forbidden(c);
  }
  const check = requirePermission(
    EntityType.OFFICE,
    Action.UPDATE,
    () => officeId,
  );
  return (await check(c, async () => {})) ?? null;
};

const letterheadExtractHandler = async (c: Context<RBACContext>) => {
  try {
    const userId = c.get("user").userId;
    if (!isWithinUserLimit(userId)) {
      return c.json(
        { error: "Rate limit exceeded. Please try again later." },
        429,
      );
    }

    const body = letterheadExtractRequestSchema.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!body.success) {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const { organizationId, officeId, image, mimeType } = body.data;

    const denied = await authorize(c, organizationId, officeId);
    if (denied) {
      return denied;
    }

    const decoded = decodeLetterheadImage(image, mimeType);
    if (!decoded.ok) {
      return c.json({ error: decoded.error }, decoded.status);
    }

    const blocked = await gateCreditsOr402(c, organizationId);
    if (blocked) {
      return blocked;
    }

    const { extraction, generation } = await extractLetterheadFromImage({
      bytes: decoded.bytes,
      mimeType,
      size: decoded.size,
    });

    // meterAiCall never throws; awaited so the Worker doesn't drop it.
    await meterAiCall({
      billing: { organizationId, userId },
      source: "document",
      usage: generation.usage,
      providerMetadata: generation.providerMetadata,
      metadata: { route: ROUTE_NAME },
    });

    return c.json<LetterheadExtraction>(extraction);
  } catch (error) {
    console.error("[letterhead-extract] Error:", error);
    if (error instanceof Error && error.name === "TimeoutError") {
      return c.json({ error: "Letterhead extraction timed out" }, 504);
    }
    return c.json({ error: "Failed to read the letterhead" }, 500);
  }
};

const letterheadExtractRouter = new Hono<RBACContext>();
letterheadExtractRouter.post(
  "/letterhead/extract",
  bodyLimit({
    maxSize: MAX_LETTERHEAD_BODY_BYTES,
    onError: (c) => c.json({ error: "Image too large" }, 413),
  }),
  letterheadExtractHandler,
);

export { letterheadExtractRouter };
