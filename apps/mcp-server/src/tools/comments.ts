import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { runWithWorkerConnection } from "@wildfires-org/turboplan-db/db-client";
import {
  createComment,
  deleteComment,
  getCommentById,
  getCommentsByProjectId,
  updateCommentVisibility,
} from "@wildfires-org/turboplan-db/queries";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";

import {
  assertEntityExists,
  assertPermission,
  getMcpRBACService,
} from "../utils/permissions.js";
import { projectExists } from "../utils/queries.js";
import type { McpUserContext } from "../utils/types.js";
import { entityIdSchema, validateToolInput } from "../utils/validation.js";

const sanitizeContent = (content: string): string => {
  return content.replace(/<[^>]*>/g, "").trim();
};

export const registerCommentTools = (
  server: McpServer,
  user: McpUserContext,
) => {
  server.registerTool(
    "list_comments",
    {
      description:
        "List all comments for a project, including replies. Moderators (owners) see all comments; regular members see public comments plus their own private ones. Requires read access.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
      },
    },
    async ({ projectId }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({ projectId: entityIdSchema }),
          { projectId },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const proj = await projectExists(projectId as string);
        const notFound = assertEntityExists(
          proj,
          projectId as string,
          "project",
          user.userId,
        );
        if (notFound) {
          return notFound;
        }

        const denied = await assertPermission(
          user.userId,
          projectId as string,
          EntityType.PROJECT,
          Action.READ,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const rbacService = getMcpRBACService();
        const moderatorCheck = await rbacService.checkPermission(
          user.userId,
          projectId as string,
          EntityType.PROJECT,
          Action.MANAGE_MEMBERS,
        );

        const comments = await getCommentsByProjectId({
          projectId: projectId as string,
          currentUserId: user.userId,
          showAllPrivate: moderatorCheck.allowed,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(comments, null, 2),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "create_comment",
    {
      description:
        "Create a comment on a project. Supports one level of replies (set parentCommentId). Content is sanitized server-side. Max 5000 chars. Requires read access (any member can comment). Setting isPublic requires owner role.",
      inputSchema: {
        projectId: z.string().uuid().describe("Project UUID"),
        content: z
          .string()
          .min(1)
          .max(5000)
          .describe("Comment text (max 5000 chars, HTML stripped)"),
        parentCommentId: z
          .string()
          .uuid()
          .optional()
          .describe("Parent comment UUID for replies (one level only)"),
        isPublic: z
          .boolean()
          .optional()
          .describe(
            "Whether comment is visible on public landing page (default false)",
          ),
      },
    },
    async ({ projectId, content, parentCommentId, isPublic }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            projectId: entityIdSchema,
            content: z.string().min(1).max(5000),
            parentCommentId: z.string().uuid().optional(),
            isPublic: z.boolean().optional(),
          }),
          { projectId, content, parentCommentId, isPublic },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const denied = await assertPermission(
          user.userId,
          projectId as string,
          EntityType.PROJECT,
          Action.READ,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const validated = validation.data;

        if (validated.parentCommentId) {
          const parentComment = await getCommentById(validated.parentCommentId);
          if (
            !parentComment ||
            parentComment.projectId !== (projectId as string)
          ) {
            return {
              isError: true,
              content: [{ type: "text" as const, text: "Access denied." }],
            };
          }
        }

        let resolvedIsPublic = false;
        if (validated.isPublic === true) {
          const publicDenied = await assertPermission(
            user.userId,
            projectId as string,
            EntityType.PROJECT,
            Action.MANAGE_MEMBERS,
            user.email,
          );
          if (publicDenied) {
            return publicDenied;
          }
          resolvedIsPublic = true;
        }

        const sanitized = sanitizeContent(validated.content);

        if (sanitized.length === 0) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: "Comment content is empty after sanitization.",
              },
            ],
          };
        }

        try {
          const newComment = await createComment({
            projectId: projectId as string,
            userId: user.userId,
            content: sanitized,
            parentCommentId: validated.parentCommentId ?? null,
            isPublic: resolvedIsPublic,
          });

          await createTimelineRecord({
            projectId: projectId as string,
            userId: user.userId,
            entityType: "comment",
            entityId: newComment.id,
            action: "created",
            metadata: { source: "mcp", actor: user.actor },
          });

          const commentWithAuthor = await getCommentById(newComment.id);

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  { success: true, comment: commentWithAuthor },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to create comment";
          if (
            message.includes("only one level of nesting") ||
            message.includes("Parent comment not found")
          ) {
            return {
              isError: true,
              content: [{ type: "text" as const, text: message }],
            };
          }
          throw error;
        }
      }),
  );

  server.registerTool(
    "update_comment_visibility",
    {
      description:
        "Toggle a comment's public visibility. Making a comment public requires owner role. Making it private again is allowed for the comment author with project access, or any project owner.",
      inputSchema: {
        commentId: z.string().uuid().describe("Comment UUID"),
        isPublic: z
          .boolean()
          .describe("Whether comment should be publicly visible"),
      },
    },
    async ({ commentId, isPublic }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({
            commentId: entityIdSchema,
            isPublic: z.boolean(),
          }),
          { commentId, isPublic },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const existing = await getCommentById(commentId as string);
        if (!existing) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: "Access denied." }],
          };
        }

        // Publishing is the privileged direction: making a comment public
        // exposes it outside the project, so it always requires
        // MANAGE_MEMBERS — authorship does not grant it (create_comment gates
        // `isPublic` the same way). Un-publishing only ever narrows visibility,
        // so an author with project access may do it. Even the author must
        // still have project access, otherwise a removed member keeps toggling
        // their old comments.
        const isAuthor = existing.userId === user.userId;
        const requiredAction =
          isPublic === true || !isAuthor ? Action.MANAGE_MEMBERS : Action.READ;
        const denied = await assertPermission(
          user.userId,
          existing.projectId,
          EntityType.PROJECT,
          requiredAction,
          user.email,
        );
        if (denied) {
          return denied;
        }

        const oldIsPublic = existing.isPublic;
        const updated = await updateCommentVisibility(
          commentId as string,
          isPublic as boolean,
        );

        if (!updated) {
          return {
            isError: true,
            content: [
              {
                type: "text" as const,
                text: "Failed to update comment.",
              },
            ],
          };
        }

        await createTimelineRecord({
          projectId: existing.projectId,
          userId: user.userId,
          entityType: "comment",
          entityId: commentId as string,
          action: "updated",
          changes: [
            {
              field: "isPublic",
              previousValue: oldIsPublic,
              newValue: isPublic,
              valueType: "boolean",
            },
          ],
          metadata: { source: "mcp", actor: user.actor },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true }, null, 2),
            },
          ],
        };
      }),
  );

  server.registerTool(
    "delete_comment",
    {
      description:
        "Delete a comment and its replies. Only the comment author or a project owner can delete.",
      inputSchema: {
        commentId: z.string().uuid().describe("Comment UUID"),
      },
    },
    async ({ commentId }) =>
      runWithWorkerConnection(async () => {
        const validation = validateToolInput(
          z.object({ commentId: entityIdSchema }),
          { commentId },
        );
        if (!validation.success) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: validation.error }],
          };
        }

        const existing = await getCommentById(commentId as string);
        if (!existing) {
          return {
            isError: true,
            content: [{ type: "text" as const, text: "Access denied." }],
          };
        }

        // Author must still have project access (a removed member otherwise
        // keeps deleting old comments). Author → READ, non-author →
        // MANAGE_MEMBERS.
        const isAuthor = existing.userId === user.userId;
        const denied = await assertPermission(
          user.userId,
          existing.projectId,
          EntityType.PROJECT,
          isAuthor ? Action.READ : Action.MANAGE_MEMBERS,
          user.email,
        );
        if (denied) {
          return denied;
        }

        await deleteComment(commentId as string);

        await createTimelineRecord({
          projectId: existing.projectId,
          userId: user.userId,
          entityType: "comment",
          entityId: commentId as string,
          action: "deleted",
          metadata: { source: "mcp", actor: user.actor },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true }, null, 2),
            },
          ],
        };
      }),
  );
};
