import { Hono } from "hono";

import {
  CreditsExhaustedError,
  resolveOrganizationIdForEntity,
} from "@wildfires-org/turboplan-billing/server";
import {
  createGeneratedImage,
  deleteGeneratedImage,
  getGeneratedImageById,
  updateProjectCoverImage,
} from "@wildfires-org/turboplan-db/queries";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  getRBACServiceForRequest,
  type RBACContext,
} from "@wildfires-org/turboplan-rbac/hono";
import { deleteFile } from "@wildfires-org/turboplan-upload/server";

import { generateImage } from "../../services/image-generation-service";
import {
  autoGenerateProjectImageSchema,
  generateImageSchema,
} from "../validation";

export const imageGenerationRouter = new Hono<RBACContext>();

// POST /generate-image - Generate new image with AI
imageGenerationRouter.post("/generate-image", async (c) => {
  try {
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();

    // Validate request body
    const validationResult = generateImageSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400,
      );
    }

    const { entityId, entityType, title, style, ratio } = validationResult.data;

    // Map entity type to RBAC EntityType
    const rbacEntityType =
      entityType === "project"
        ? EntityType.PROJECT
        : entityType === "office"
          ? EntityType.OFFICE
          : EntityType.ORGANIZATION;

    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      entityId,
      rbacEntityType,
      Action.CREATE,
    );

    if (!permissionResult.allowed) {
      return c.json(
        {
          error: "Forbidden",
          reason: permissionResult.reason,
        },
        403,
      );
    }

    // Generate image using OpenRouter (this also uploads to R2)
    let blobUrl: string | null = null;

    try {
      const organizationId = await resolveOrganizationIdForEntity(
        entityType,
        entityId,
      );
      const result = await generateImage(
        {
          title,
          style,
          ratio,
          entityId,
          entityType,
          billing: organizationId
            ? { organizationId, userId: user.userId }
            : null,
        },
        "image-primary",
      );
      blobUrl = result.imageUrl;

      // Save to database
      const savedImage = await createGeneratedImage({
        entityId,
        entityType,
        imageUrl: blobUrl,
        prompt: result.prompt,
        createdBy: user.userId,
      });

      return c.json(
        {
          success: true,
          image: savedImage,
        },
        201,
      );
    } catch (error) {
      // Cleanup blob if it was uploaded but DB insert failed
      if (blobUrl) {
        try {
          await deleteFile(blobUrl);
          console.log("Cleaned up orphaned blob:", blobUrl);
        } catch (cleanupError) {
          console.error("Failed to cleanup blob after error:", cleanupError);
        }
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof CreditsExhaustedError) {
      return c.json({ error: error.message, code: "CREDITS_EXHAUSTED" }, 402);
    }
    console.error("Error generating image:", error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate image",
      },
      500,
    );
  }
});

// POST /auto-generate-project-image - Auto-generate and set cover image for a project
imageGenerationRouter.post("/auto-generate-project-image", async (c) => {
  try {
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();

    // Validate request body
    const validationResult = autoGenerateProjectImageSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400,
      );
    }

    const { projectId, projectTitle } = validationResult.data;

    // Check permission - user needs CREATE permission on the project
    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      projectId,
      EntityType.PROJECT,
      Action.CREATE,
    );

    if (!permissionResult.allowed) {
      return c.json(
        {
          error: "Forbidden",
          reason: permissionResult.reason,
        },
        403,
      );
    }

    // Generate image using OpenRouter (this also uploads to R2)
    let blobUrl: string | null = null;

    try {
      const organizationId = await resolveOrganizationIdForEntity(
        "project",
        projectId,
      );
      const result = await generateImage(
        {
          title: projectTitle,
          entityId: projectId,
          entityType: "project",
          billing: organizationId
            ? { organizationId, userId: user.userId }
            : null,
        },
        "image-primary",
      );
      blobUrl = result.imageUrl;

      // Save to database
      const savedImage = await createGeneratedImage({
        entityId: projectId,
        entityType: "project",
        imageUrl: blobUrl,
        prompt: result.prompt,
        createdBy: user.userId,
      });

      // Set as project cover image (using the image ID)
      await updateProjectCoverImage(projectId, savedImage.id);

      return c.json(
        {
          success: true,
          image: savedImage,
          imageId: savedImage.id,
          imageUrl: blobUrl,
        },
        201,
      );
    } catch (error) {
      // Cleanup blob if it was uploaded but DB insert failed
      if (blobUrl) {
        try {
          await deleteFile(blobUrl);
          console.log("Cleaned up orphaned blob:", blobUrl);
        } catch (cleanupError) {
          console.error("Failed to cleanup blob after error:", cleanupError);
        }
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof CreditsExhaustedError) {
      return c.json({ error: error.message, code: "CREDITS_EXHAUSTED" }, 402);
    }
    console.error("Error auto-generating project cover image:", error);
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to auto-generate project cover image",
      },
      500,
    );
  }
});

// GET /generated-images/:id - Get single generated image
imageGenerationRouter.get("/generated-images/:id", async (c) => {
  try {
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const imageId = c.req.param("id");

    // Get the image
    const image = await getGeneratedImageById(imageId);
    if (!image) {
      return c.json({ error: "Image not found" }, 404);
    }

    // Map entity type to RBAC EntityType
    const rbacEntityType =
      image.entityType === "project"
        ? EntityType.PROJECT
        : image.entityType === "office"
          ? EntityType.OFFICE
          : EntityType.ORGANIZATION;

    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      image.entityId,
      rbacEntityType,
      Action.READ,
    );

    if (!permissionResult.allowed) {
      return c.json(
        {
          error: "Forbidden",
          reason: permissionResult.reason,
        },
        403,
      );
    }

    return c.json(image);
  } catch (error) {
    console.error("Error fetching image:", error);
    return c.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch image",
      },
      500,
    );
  }
});

// DELETE /generated-images/:id - Delete generated image
imageGenerationRouter.delete("/generated-images/:id", async (c) => {
  try {
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const imageId = c.req.param("id");

    // Get the image to check permissions
    const image = await getGeneratedImageById(imageId);
    if (!image) {
      return c.json({ error: "Image not found" }, 404);
    }

    // Map entity type to RBAC EntityType
    const rbacEntityType =
      image.entityType === "project"
        ? EntityType.PROJECT
        : image.entityType === "office"
          ? EntityType.OFFICE
          : EntityType.ORGANIZATION;

    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      image.entityId,
      rbacEntityType,
      Action.DELETE,
    );

    if (!permissionResult.allowed) {
      return c.json(
        {
          error: "Forbidden",
          reason: permissionResult.reason,
        },
        403,
      );
    }

    // Delete from blob storage
    try {
      await deleteFile(image.imageUrl);
    } catch (error) {
      console.error("Error deleting blob:", error);
      // Continue anyway - we'll delete the DB record
    }

    // Delete from database
    await deleteGeneratedImage(imageId);

    return c.json({ success: true, message: "Image deleted successfully" });
  } catch (error) {
    console.error("Error deleting image:", error);
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete image",
      },
      500,
    );
  }
});
