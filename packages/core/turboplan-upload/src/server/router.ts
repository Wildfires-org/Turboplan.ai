import { Hono } from "hono";
import { z } from "zod";

import { deleteFile, isOwnedUploadUrl, isStorageUrl } from "./r2-client";

import "@wildfires-org/turboplan-api-client/server";

import { ABSOLUTE_MAX_FILE_SIZE, UploadError, UploadErrorCode } from "../types";
import { uploadService } from "./UploadService";

const presignSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().positive().max(ABSOLUTE_MAX_FILE_SIZE),
  maxSize: z.number().positive().max(ABSOLUTE_MAX_FILE_SIZE).optional(),
});

export const uploadRouter = new Hono();

uploadRouter.post("/presign", async (c) => {
  try {
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const parsed = presignSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        {
          error: "Invalid request",
          code: UploadErrorCode.VALIDATION_ERROR,
          details: parsed.error.flatten().fieldErrors,
        },
        400,
      );
    }

    const { filename, contentType, fileSize, maxSize } = parsed.data;

    const result = await uploadService.generatePresignedUrl(
      filename,
      contentType,
      fileSize,
      user.userId,
      maxSize,
    );

    return c.json(result);
  } catch (error) {
    if (error instanceof UploadError) {
      return c.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        error.code === UploadErrorCode.UNAUTHORIZED ? 401 : 400,
      );
    }

    console.error("Presigned URL generation error:", error);
    return c.json(
      {
        error: "Failed to generate presigned URL",
        code: UploadErrorCode.SERVER_ERROR,
      },
      500,
    );
  }
});

uploadRouter.delete("/", async (c) => {
  try {
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return c.json(
        {
          error: "Invalid request",
          details: "url parameter is required and must be a string",
        },
        400,
      );
    }

    if (!isStorageUrl(url)) {
      return c.json(
        {
          error: "Invalid URL",
          details: "URL must be a valid storage URL",
        },
        400,
      );
    }

    // Ownership is decided on the canonical key, never on a substring of the
    // raw URL: `.../uploads/<attacker>/../<victim>/f.pdf` contains the caller's
    // own prefix yet resolves to another user's object.
    if (!isOwnedUploadUrl(url, user.userId)) {
      return c.json(
        {
          error: "Forbidden",
          details: "You can only delete your own uploads via this endpoint",
        },
        403,
      );
    }

    await deleteFile(url);

    return c.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("File deletion error:", error);

    return c.json(
      {
        error: "Failed to delete file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});
