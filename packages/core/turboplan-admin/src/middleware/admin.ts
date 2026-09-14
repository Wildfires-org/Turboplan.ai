import type { Context, Next } from "hono";

import { getUserWithProfile } from "@wildfires-org/turboplan-db/queries";
import { isSuperAdmin } from "@wildfires-org/turboplan-rbac";
import { isAdmin } from "@wildfires-org/turboplan-rbac/server";

/**
 * Admin middleware — requires user to be an admin (super admin OR DB admin).
 * Must be used after authMiddleware.
 */
export const adminMiddleware = async (c: Context, next: Next) => {
  if (c.req.method === "OPTIONS") {
    return next();
  }

  const authUser = c.get("user");

  if (!authUser?.userId) {
    return c.json({ error: "Unauthorized - No user context" }, 401);
  }

  try {
    const result = await getUserWithProfile(authUser.userId);

    if (!result?.user) {
      return c.json({ error: "Unauthorized - User not found" }, 401);
    }

    const userIsAdmin = await isAdmin(authUser.userId, result.user.email);

    if (!userIsAdmin) {
      return c.json({ error: "Forbidden - Admin access required" }, 403);
    }

    c.set("adminEmail", result.user.email);

    await next();
  } catch (error) {
    console.error("Admin middleware error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
};

/**
 * Super admin middleware — requires user to be a super admin (ADMIN_EMAILS env).
 * Must be used after authMiddleware. Use for sensitive operations like managing admin users.
 */
export const superAdminMiddleware = async (c: Context, next: Next) => {
  if (c.req.method === "OPTIONS") {
    return next();
  }

  const authUser = c.get("user");

  if (!authUser?.userId) {
    return c.json({ error: "Unauthorized - No user context" }, 401);
  }

  try {
    const adminEmail = c.get("adminEmail") as string | undefined;

    let email: string;
    if (adminEmail) {
      email = adminEmail;
    } else {
      const result = await getUserWithProfile(authUser.userId);
      if (!result?.user) {
        return c.json({ error: "Unauthorized - User not found" }, 401);
      }
      email = result.user.email;
    }

    if (!isSuperAdmin(email)) {
      return c.json({ error: "Forbidden - Super admin access required" }, 403);
    }

    await next();
  } catch (error) {
    console.error("Super admin middleware error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
};
