// ============================================================================
// USERS ROUTER
// ============================================================================
// Provides REST API endpoint for searching users by email or name.
// ============================================================================

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import type { RBACContext } from "@wildfires-org/turboplan-rbac/hono";

import {
  DEFAULT_USER_SEARCH_LIMIT,
  MAX_USER_SEARCH_LIMIT,
  MIN_USER_QUERY_LENGTH,
  searchUsers,
} from "../users/queries";

const userSearchQuerySchema = z.object({
  q: z.string().min(MIN_USER_QUERY_LENGTH),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_USER_SEARCH_LIMIT)
    .default(DEFAULT_USER_SEARCH_LIMIT)
    .optional(),
});

export const usersRouter = new Hono<RBACContext>();

/**
 * GET /search?q=<query>&limit=10
 * Search users by email or name using fuzzy matching.
 *
 * Query params:
 * - q: Search query (required, minimum 3 characters)
 * - limit: Maximum results to return (optional, default 10, max 50)
 *
 * Returns: Array of matching users with id, email, firstName, lastName, avatarUrl
 */
usersRouter.get(
  "/search",
  zValidator("query", userSearchQuerySchema),
  async (c) => {
    try {
      const { q, limit = DEFAULT_USER_SEARCH_LIMIT } = c.req.valid("query");

      const users = await searchUsers(q, limit);

      // Remove similarity score from response (internal ranking detail)
      const sanitizedUsers = users.map(({ similarity, ...user }) => user);

      return c.json({ users: sanitizedUsers });
    } catch (error) {
      console.error("Error searching users:", error);
      return c.json({ users: [], message: "Failed to search users" }, 500);
    }
  },
);
