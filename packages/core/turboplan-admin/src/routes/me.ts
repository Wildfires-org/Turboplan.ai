import { Hono } from "hono";

import {
  getUserWithProfile,
  isAdminUser,
} from "@wildfires-org/turboplan-db/queries";
import { isSuperAdmin } from "@wildfires-org/turboplan-rbac";
import type { RBACContext } from "@wildfires-org/turboplan-rbac/hono";

import type { AdminStatusResponse } from "../types";

const meRouter = new Hono<RBACContext>();

/**
 * GET /
 * Returns the current user's admin status.
 * This endpoint is called by the sidebar to decide whether to show the admin link.
 * It does NOT require admin middleware — any authenticated user can check their own status.
 */
meRouter.get("/", async (c) => {
  const authUser = c.get("user");

  if (!authUser?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const result = await getUserWithProfile(authUser.userId);
    const email = result?.user?.email;

    // Check super admin first (env-only, no DB hit)
    const userIsSuperAdmin = isSuperAdmin(email);
    // Only query DB for admin_user table if not already a super admin
    const userIsAdmin =
      userIsSuperAdmin || (await isAdminUser(authUser.userId));

    const response: AdminStatusResponse = {
      isAdmin: userIsAdmin,
      isSuperAdmin: userIsSuperAdmin,
    };

    return c.json(response);
  } catch (error) {
    console.error("Failed to check admin status:", error);
    return c.json({ error: "Failed to check admin status" }, 500);
  }
});

export { meRouter };
