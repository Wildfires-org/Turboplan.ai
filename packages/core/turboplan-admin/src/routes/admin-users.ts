import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import {
  addAdminUser,
  getAdminUsers,
  removeAdminUser,
} from "@wildfires-org/turboplan-db/queries";
import type { RBACContext } from "@wildfires-org/turboplan-rbac/hono";

import { superAdminMiddleware } from "../middleware/admin";

const adminUsersRouter = new Hono<RBACContext>();

/**
 * GET /
 * List all admin users with their profile info.
 * Available to any admin.
 */
adminUsersRouter.get("/", async (c) => {
  try {
    const adminUsers = await getAdminUsers();
    return c.json({ adminUsers });
  } catch (error) {
    console.error("Failed to get admin users:", error);
    return c.json({ error: "Failed to get admin users" }, 500);
  }
});

/**
 * POST /
 * Add a user as an admin. Super admin only.
 * Body: { userId: string }
 */
adminUsersRouter.post(
  "/",
  superAdminMiddleware,
  zValidator("json", z.object({ userId: z.string().uuid() })),
  async (c) => {
    try {
      const { userId } = c.req.valid("json");

      const createdBy = c.get("user").userId;
      const adminUser = await addAdminUser(userId, createdBy);

      return c.json({ adminUser }, 201);
    } catch (error) {
      console.error("Failed to add admin user:", error);
      return c.json({ error: "Failed to add admin user" }, 500);
    }
  },
);

/**
 * DELETE /:userId
 * Remove a user from admin role. Super admin only.
 */
adminUsersRouter.delete(
  "/:userId",
  superAdminMiddleware,
  zValidator("param", z.object({ userId: z.string().uuid() })),
  async (c) => {
    try {
      const { userId } = c.req.valid("param");

      const removed = await removeAdminUser(userId);

      if (!removed) {
        return c.json({ error: "Admin user not found" }, 404);
      }

      return c.json({ success: true });
    } catch (error) {
      console.error("Failed to remove admin user:", error);
      return c.json({ error: "Failed to remove admin user" }, 500);
    }
  },
);

export { adminUsersRouter };
