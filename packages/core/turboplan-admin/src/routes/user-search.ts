import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import type { RBACContext } from "@wildfires-org/turboplan-rbac/hono";
import {
  DEFAULT_USER_SEARCH_LIMIT,
  MAX_USER_SEARCH_LIMIT,
  MIN_USER_QUERY_LENGTH,
  searchUsers,
} from "@wildfires-org/turboplan-workspace/server";

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

const userSearchRouter = new Hono<RBACContext>();

/**
 * GET /search?q=<query>&limit=10
 * Fuzzy search across every account, for platform admin tooling (e.g. picking
 * a new admin). The public `/api/users/search` is scoped to an organization
 * tree; only this admin-guarded route searches globally.
 */
userSearchRouter.get(
  "/search",
  zValidator("query", userSearchQuerySchema),
  async (c) => {
    try {
      const { q, limit = DEFAULT_USER_SEARCH_LIMIT } = c.req.valid("query");
      const users = await searchUsers(q, limit, { global: true });

      // Remove similarity score from response (internal ranking detail)
      return c.json({ users: users.map(({ similarity, ...user }) => user) });
    } catch (error) {
      console.error("Failed to search users:", error);
      return c.json({ users: [], message: "Failed to search users" }, 500);
    }
  },
);

export { userSearchRouter };
