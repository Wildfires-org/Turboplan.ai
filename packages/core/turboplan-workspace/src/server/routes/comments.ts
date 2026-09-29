/**
 * Comments API routes
 *
 * Dashboard routes (authenticated):
 * - GET /api/comments?projectId=xxx - List all comments for a project
 * - POST /api/comments - Create a comment or reply
 * - PATCH /api/comments/:id - Toggle comment visibility (isPublic)
 * - DELETE /api/comments/:id - Delete a comment
 *
 * Public route is handled in the server's public.ts
 */

import { Hono } from "hono";
import { z } from "zod";

import {
  createComment,
  deleteComment,
  getCommentById,
  getCommentsByProjectId,
  updateCommentVisibility,
} from "@wildfires-org/turboplan-db/queries";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  getRBACServiceForRequest,
  isPublicGovProjectReadAllowed,
  type RBACContext,
} from "@wildfires-org/turboplan-rbac/hono";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";

/**
 * Sanitize comment content to prevent XSS attacks.
 * Strips HTML tags and trims whitespace.
 */
function sanitizeContent(content: string): string {
  return content.replace(/<[^>]*>/g, "").trim();
}

// Zod validation schemas
const createCommentSchema = z.object({
  projectId: z.string().uuid("Invalid project ID"),
  content: z
    .string()
    .min(1, "Content is required")
    .max(5000, "Content too long"),
  parentCommentId: z
    .string()
    .uuid("Invalid parent comment ID")
    .nullable()
    .optional(),
  isPublic: z.boolean().default(false),
});

const updateCommentVisibilitySchema = z.object({
  isPublic: z.boolean(),
});

export const commentsRouter = new Hono<RBACContext>();

/**
 * GET / - List comments for a project (authenticated, includes private comments)
 * Query params:
 * - projectId (required): The project to get comments for
 */
commentsRouter.get("/", async (c) => {
  try {
    const user = c.get("user");
    const projectId = c.req.query("projectId");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!projectId) {
      return c.json({ error: "projectId is required" }, 400);
    }

    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const parseResult = uuidSchema.safeParse(projectId);
    if (!parseResult.success) {
      return c.json({ error: "Invalid projectId format" }, 400);
    }

    // Check if user has READ permission on the project, with fallback allowing
    // any authenticated user to read comments from public government projects.
    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      projectId,
      EntityType.PROJECT,
      Action.READ,
    );

    if (!permissionResult.allowed) {
      const allowedAsPublic = await isPublicGovProjectReadAllowed(projectId, {
        moduleName: "comments",
      });
      if (!allowedAsPublic) {
        return c.json(
          { error: "Forbidden", reason: permissionResult.reason },
          403,
        );
      }
    }

    // Check if user is a moderator (has MANAGE_MEMBERS permission).
    // Non-members viewing via public-gov fallback are never moderators.
    const moderatorCheck = permissionResult.allowed
      ? await rbacService.checkPermission(
          user.userId,
          projectId,
          EntityType.PROJECT,
          Action.MANAGE_MEMBERS,
        )
      : { allowed: false };

    // Get comments with visibility filtering:
    // - Moderators see all comments
    // - Regular users see public + their own private comments
    // - Non-members get the public projection (no commenter emails)
    const comments = await getCommentsByProjectId({
      projectId,
      currentUserId: user.userId,
      showAllPrivate: moderatorCheck.allowed,
      publicView: !permissionResult.allowed,
    });

    return c.json(comments);
  } catch (error) {
    console.error("Failed to get comments:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * POST / - Create a comment or reply
 * Body:
 * - projectId: UUID of the project
 * - content: Comment text (sanitized server-side to prevent XSS)
 * - parentCommentId (optional): UUID of parent comment for replies
 * - isPublic (optional, default false): Visibility on landing page
 */
commentsRouter.post("/", async (c) => {
  try {
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();

    // Validate request body
    const validationResult = createCommentSchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400,
      );
    }

    const { projectId, content, parentCommentId, isPublic } =
      validationResult.data;

    // Sanitize content to prevent XSS
    const sanitizedContent = sanitizeContent(content);

    // Check if user has READ permission on the project (any member can comment)
    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      projectId,
      EntityType.PROJECT,
      Action.READ,
    );

    if (!permissionResult.allowed) {
      return c.json(
        { error: "Forbidden", reason: permissionResult.reason },
        403,
      );
    }

    // Creating a PUBLIC comment publishes it to the landing page — that is a
    // moderator action (MANAGE_MEMBERS), matching the PATCH visibility rule. Any
    // member may still create a private comment with READ.
    if (isPublic) {
      const moderatorCheck = await rbacService.checkPermission(
        user.userId,
        projectId,
        EntityType.PROJECT,
        Action.MANAGE_MEMBERS,
      );
      if (!moderatorCheck.allowed) {
        return c.json(
          {
            error: "Forbidden",
            reason: "Publishing a comment requires MANAGE_MEMBERS",
          },
          403,
        );
      }
    }

    // Create the comment
    const newComment = await createComment({
      projectId,
      userId: user.userId,
      content: sanitizedContent,
      parentCommentId: parentCommentId ?? null,
      isPublic,
    });

    await createTimelineRecord({
      projectId,
      userId: user.userId,
      entityType: "comment",
      entityId: newComment.id,
      action: "created",
    });

    // Return the created comment with author info
    const commentWithAuthor = await getCommentById(newComment.id);

    return c.json(commentWithAuthor, 201);
  } catch (error) {
    console.error("Failed to create comment:", error);

    // Handle specific error for nested replies
    if (
      error instanceof Error &&
      error.message.includes("only one level of nesting")
    ) {
      return c.json({ error: error.message }, 400);
    }

    if (
      error instanceof Error &&
      error.message.includes("Parent comment not found")
    ) {
      return c.json({ error: "Parent comment not found" }, 404);
    }

    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * PATCH /:id - Toggle comment visibility (isPublic)
 * Body:
 * - isPublic: boolean
 *
 * Authorization:
 * - isPublic: true  → always requires MANAGE_MEMBERS. Publishing exposes the
 *   comment outside the project, so authorship does not grant it (POST gates
 *   `isPublic` the same way).
 * - isPublic: false → comment author with READ access on the project, or
 *   anyone with MANAGE_MEMBERS. Un-publishing only narrows visibility.
 */
commentsRouter.patch("/:id", async (c) => {
  try {
    const user = c.get("user");
    const commentId = c.req.param("id");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const parseResult = uuidSchema.safeParse(commentId);
    if (!parseResult.success) {
      return c.json({ error: "Invalid comment ID format" }, 400);
    }

    // Get the comment to check ownership and project
    const existingComment = await getCommentById(commentId);
    if (!existingComment) {
      return c.json({ error: "Comment not found" }, 404);
    }

    // The requested visibility decides which permission is required, so the
    // body has to be parsed before the authorization check.
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    // Validate request body
    const validationResult = updateCommentVisibilitySchema.safeParse(body);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400,
      );
    }

    const { isPublic } = validationResult.data;

    // Publishing always requires MANAGE_MEMBERS, regardless of authorship.
    // Un-publishing is allowed for the author, but they must still hold READ on
    // the project — a removed member should not keep toggling old comments.
    const isAuthor = existingComment.userId === user.userId;
    const requiredAction =
      isPublic || !isAuthor ? Action.MANAGE_MEMBERS : Action.READ;

    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      existingComment.projectId,
      EntityType.PROJECT,
      requiredAction,
    );

    if (!permissionResult.allowed) {
      return c.json({ error: "Forbidden" }, 403);
    }

    // Capture old value for timeline record
    const oldIsPublic = existingComment.isPublic;

    // Update visibility
    const updatedComment = await updateCommentVisibility(commentId, isPublic);

    if (!updatedComment) {
      return c.json({ error: "Failed to update comment" }, 500);
    }

    await createTimelineRecord({
      projectId: existingComment.projectId,
      userId: user.userId,
      entityType: "comment",
      entityId: commentId,
      action: "updated",
      changes: [
        {
          field: "isPublic",
          previousValue: oldIsPublic,
          newValue: isPublic,
          valueType: "boolean",
        },
      ],
    });

    // Return updated comment with author info
    const commentWithAuthor = await getCommentById(commentId);
    return c.json(commentWithAuthor);
  } catch (error) {
    console.error("Failed to update comment visibility:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * DELETE /:id - Delete a comment
 *
 * Authorization: Comment author OR project owner (MANAGE_MEMBERS permission)
 */
commentsRouter.delete("/:id", async (c) => {
  try {
    const user = c.get("user");
    const commentId = c.req.param("id");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Validate UUID format
    const uuidSchema = z.string().uuid();
    const parseResult = uuidSchema.safeParse(commentId);
    if (!parseResult.success) {
      return c.json({ error: "Invalid comment ID format" }, 400);
    }

    // Get the comment to check ownership and project
    const existingComment = await getCommentById(commentId);
    if (!existingComment) {
      return c.json({ error: "Comment not found" }, 404);
    }

    // Check authorization: user is author OR has MANAGE_MEMBERS permission on project
    const isAuthor = existingComment.userId === user.userId;

    if (!isAuthor) {
      const rbacService = getRBACServiceForRequest(c);
      const permissionResult = await rbacService.checkPermission(
        user.userId,
        existingComment.projectId,
        EntityType.PROJECT,
        Action.MANAGE_MEMBERS,
      );

      if (!permissionResult.allowed) {
        return c.json({ error: "Forbidden" }, 403);
      }
    }

    // Delete the comment (and its replies)
    await deleteComment(commentId);

    await createTimelineRecord({
      projectId: existingComment.projectId,
      userId: user.userId,
      entityType: "comment",
      entityId: commentId,
      action: "deleted",
    });

    return c.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Failed to delete comment:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
