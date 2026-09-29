import { Hono } from "hono";

import { adminUsersRouter } from "./admin-users";
import { aiModelsRouter } from "./ai-models";
import { promptsRouter } from "./prompts";
import { userSearchRouter } from "./user-search";
import { webhookLogsRouter } from "./webhook-logs";

/**
 * Admin router — all sub-routes require admin middleware.
 * Mounted at /api/admin in the server.
 */
const adminRouter = new Hono();

adminRouter.route("/prompts", promptsRouter);
adminRouter.route("/admin-users", adminUsersRouter);
adminRouter.route("/webhook-logs", webhookLogsRouter);
adminRouter.route("/ai-models", aiModelsRouter);
adminRouter.route("/users", userSearchRouter);

export { adminRouter };

/**
 * Admin status router — does NOT require admin middleware.
 * Any authenticated user can check their own admin status.
 * Mounted separately (outside /api/admin/*) to bypass admin middleware.
 */
export { meRouter as adminMeRouter } from "./me";
