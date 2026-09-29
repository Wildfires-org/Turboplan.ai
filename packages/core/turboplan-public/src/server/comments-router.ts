/**
 * Public Comments Router
 *
 * Endpoint for fetching public comments for a project.
 * - Anonymous users: Only public comments (isPublic=true)
 * - Logged-in users: Public comments + their own private comments
 */

import { Hono } from "hono";

import { optionalAuthMiddleware } from "@wildfires-org/turboplan-api-client/server";
import {
  createCommentWithAuthor,
  getCommentsByProjectId,
} from "@wildfires-org/turboplan-db/queries";

import { getProjectBySlugs } from "../queries";
import { generateAutoResponseForComment } from "./auto-responder";
import { createRateLimiter, extractClientIp } from "./rate-limit";

// Per-user: 5 comments/minute — the original spam guard, unchanged.
const checkRateLimit = createRateLimiter({ maxRequests: 5, windowMs: 60_000 });

// Per-IP: a second axis so a burst spread across multiple accounts (or one
// account replayed from a script) from the same network origin is still
// caught, matching the rate-limit pattern used by sibling public AI routes
// (apps/server/src/utils/ip-rate-limit.ts).
const checkIpRateLimit = createRateLimiter({
  maxRequests: 10,
  windowMs: 60_000,
});

// Per-PROJECT, on the auto-response trigger specifically (not comment
// creation in general): the credit gate on the metered LLM call is
// check-then-act by design (see credits.ts), so a burst of concurrent
// requests can each pass the gate before any of them consumes — regardless
// of how many distinct users or IPs are involved. This bounds that race
// window to a small, fixed number of in-flight requests per project, the
// same "accepted, bounded by in-flight requests" shape used elsewhere in
// billing (e.g. the seat-cap check-then-act comment in entitlements.ts).
const checkProjectAutoResponseRateLimit = createRateLimiter({
  maxRequests: 3,
  windowMs: 10_000,
});

export const publicCommentsRouter = new Hono();

/**
 * GET /:orgSlug/:officeSlug/:projectSlug/comments - Get public comments
 *
 * Returns comments for a public project.
 * - Anonymous users: Only public comments (isPublic=true)
 * - Logged-in users: Public comments + their own private comments
 */
publicCommentsRouter.get(
  "/:orgSlug/:officeSlug/:projectSlug/comments",
  optionalAuthMiddleware,
  async (c) => {
    try {
      const { orgSlug, officeSlug, projectSlug } = c.req.param();
      const user = c.get("user");

      // Fetch project using shared query function
      const p = await getProjectBySlugs(orgSlug, officeSlug, projectSlug);

      if (!p) {
        return c.json({ error: "Project not found" }, 404);
      }

      // Check if project is publicly accessible
      if (!p.isPublic || p.status === "archived" || p.isTemplate) {
        return c.json({ error: "Project not found" }, 404);
      }

      // Check if comments module is hidden from public
      const hiddenModules = (p.hiddenModules as string[]) || [];
      const privateModules = (p.privateModules as string[]) || [];

      if (
        hiddenModules.includes("comments") ||
        privateModules.includes("comments")
      ) {
        return c.json({ comments: [], isHidden: true });
      }

      // Get comments: public + user's own private comments if logged in
      const comments = await getCommentsByProjectId({
        projectId: p.id,
        currentUserId: user?.userId,
        publicView: true,
      });

      return c.json({ comments, isHidden: false });
    } catch (error) {
      console.error("Failed to get public comments:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

/**
 * Sanitize comment content to prevent XSS attacks.
 * Strips HTML tags and trims whitespace.
 */
function sanitizeContent(content: string): string {
  return content.replace(/<[^>]*>/g, "").trim();
}

/**
 * POST /:orgSlug/:officeSlug/:projectSlug/comments - Create a comment or reply on a public project
 *
 * Requires authentication. Creates a private comment/reply.
 * Only triggers auto-response for top-level comments (not replies).
 *
 * Body:
 * - content: Comment text (sanitized server-side to prevent XSS)
 * - parentCommentId (optional): Parent comment ID for replies
 */
publicCommentsRouter.post(
  "/:orgSlug/:officeSlug/:projectSlug/comments",
  optionalAuthMiddleware,
  async (c) => {
    try {
      const { orgSlug, officeSlug, projectSlug } = c.req.param();
      const user = c.get("user");

      // Require authentication for posting comments
      if (!user?.userId) {
        return c.json({ error: "Authentication required" }, 401);
      }

      // Rate limit by user ID and by IP to prevent spam — either axis alone
      // is bypassable (multiple accounts, or one account behind a shared
      // client), so both must pass.
      if (
        !checkRateLimit(user.userId) ||
        !checkIpRateLimit(extractClientIp(c))
      ) {
        return c.json(
          { error: "Too many comments. Please try again later." },
          429,
        );
      }

      // Fetch project using shared query function
      const p = await getProjectBySlugs(orgSlug, officeSlug, projectSlug);

      if (!p) {
        return c.json({ error: "Project not found" }, 404);
      }

      // Check if project is publicly accessible
      if (!p.isPublic || p.status === "archived" || p.isTemplate) {
        return c.json({ error: "Project not found" }, 404);
      }

      // Check if comments module is hidden from public
      const hiddenModules = (p.hiddenModules as string[]) || [];
      const privateModules = (p.privateModules as string[]) || [];

      if (
        hiddenModules.includes("comments") ||
        privateModules.includes("comments")
      ) {
        return c.json({ error: "Comments are disabled for this project" }, 403);
      }

      // Parse and validate request body
      const body = await c.req.json();
      const { content, parentCommentId } = body;

      if (!content || typeof content !== "string") {
        return c.json({ error: "Content is required" }, 400);
      }

      if (content.trim().length === 0) {
        return c.json({ error: "Content cannot be empty" }, 400);
      }

      if (content.length > 5000) {
        return c.json({ error: "Content too long (max 5000 characters)" }, 400);
      }

      // Validate parentCommentId if provided
      if (parentCommentId && typeof parentCommentId !== "string") {
        return c.json({ error: "Invalid parentCommentId" }, 400);
      }

      // Sanitize content to prevent XSS
      const sanitizedContent = sanitizeContent(content);

      // Create the comment and return with author info (private by default)
      const commentWithAuthor = await createCommentWithAuthor({
        projectId: p.id,
        userId: user.userId,
        content: sanitizedContent,
        parentCommentId: parentCommentId || null,
        isPublic: false,
      });

      // Only trigger auto-response for top-level comments, not replies.
      // Separately rate-limited per PROJECT — the credit gate this feeds is
      // check-then-act, so this bounds how many concurrent generations can
      // race it regardless of how many distinct users/IPs are involved.
      if (!parentCommentId && checkProjectAutoResponseRateLimit(p.id)) {
        generateAutoResponseForComment({
          commentId: commentWithAuthor.id,
          projectId: p.id,
          commenterId: user.userId,
        }).catch((err) =>
          console.error(
            "[public-comments] Auto-response generation failed:",
            err,
          ),
        );
      }

      return c.json(commentWithAuthor, 201);
    } catch (error) {
      console.error("Failed to create public comment:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);
