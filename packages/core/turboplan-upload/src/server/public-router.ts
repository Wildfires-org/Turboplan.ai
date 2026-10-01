import { Hono } from "hono";
import { z } from "zod";

import { UploadError, UploadErrorCode } from "../types";
import { uploadService } from "./UploadService";

const landingPresignSchema = z.object({
  filename: z.string().min(1).max(1024),
  contentType: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
});

/**
 * Unauthenticated upload endpoints for the landing page. There is no identity
 * to gate on, so the mount point must put a per-IP rate limit in front.
 *
 * POST /presign — `{ filename, contentType, fileSize }` → `{ uploadUrl, key }`.
 * The browser then PUTs the file to `uploadUrl` with the same `Content-Type`;
 * `key` is later handed to the signup / project creation that claims it.
 */
export const publicUploadRouter = new Hono();

publicUploadRouter.post("/presign", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = landingPresignSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid request", code: UploadErrorCode.VALIDATION_ERROR },
      400,
    );
  }

  const { filename, contentType, fileSize } = parsed.data;

  try {
    const { uploadUrl, key } = await uploadService.generateLandingPresignedUrl(
      filename,
      contentType,
      fileSize,
    );

    return c.json({ uploadUrl, key });
  } catch (error) {
    if (error instanceof UploadError) {
      return c.json({ error: error.message, code: error.code }, 400);
    }

    console.error("Landing presigned URL generation error:", error);
    return c.json(
      {
        error: "Failed to generate presigned URL",
        code: UploadErrorCode.SERVER_ERROR,
      },
      500,
    );
  }
});
