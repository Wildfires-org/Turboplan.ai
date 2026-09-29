/**
 * Public Timeline Router
 *
 * Endpoint for fetching public timeline records for a public project
 * without authentication. Only returns records marked as public.
 */

import { Hono } from "hono";

import { getProjectBySlugs } from "../queries/projects";
import { getPublicTimelineRecords } from "../queries/timeline";

export const publicTimelineRouter = new Hono();

/**
 * GET /:orgSlug/:officeSlug/:projectSlug/timeline - Get public timeline records
 *
 * Returns public timeline records for a public project.
 * Only returns data if the timeline module is not hidden by the project owner.
 */
publicTimelineRouter.get(
  "/:orgSlug/:officeSlug/:projectSlug/timeline",
  async (c) => {
    try {
      const { orgSlug, officeSlug, projectSlug } = c.req.param();

      const p = await getProjectBySlugs(orgSlug, officeSlug, projectSlug);

      if (!p) {
        return c.json({ error: "Project not found" }, 404);
      }

      if (!p.isPublic || p.status === "archived" || p.isTemplate) {
        return c.json({ error: "Project not found" }, 404);
      }

      const hiddenModules = p.hiddenModules ?? [];
      const privateModules = p.privateModules ?? [];

      const isModuleHiddenFromPublic = (moduleName: string) =>
        hiddenModules.includes(moduleName) ||
        privateModules.includes(moduleName);

      if (isModuleHiddenFromPublic("timeline")) {
        return c.json({ records: [], isHidden: true });
      }

      const records = await getPublicTimelineRecords(p.id, {
        hiddenModules,
        privateModules,
      });

      return c.json({ records, isHidden: false });
    } catch (error) {
      console.error("Failed to get public timeline records:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);
