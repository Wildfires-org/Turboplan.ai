/**
 * Public Organizations Router
 *
 * Endpoints for fetching organizations without authentication.
 * Used for signup dropdowns to select organization affiliation.
 */

import { Hono } from "hono";

import {
  getActiveGovernmentOrganizations,
  getPublicOrganizationBySlug,
} from "../queries/organizations";

export const publicOrganizationsRouter = new Hono();

/**
 * GET / - List all active government organizations
 *
 * Returns a list of organizations for signup dropdowns.
 * Only returns organizations that are:
 * - status = 'active'
 * - type = 'government' (seeded government agencies)
 *
 * Returns minimal fields for dropdown display.
 */
publicOrganizationsRouter.get("/", async (c) => {
  try {
    const organizations = await getActiveGovernmentOrganizations();
    return c.json(organizations);
  } catch (error) {
    console.error("Failed to get public organizations:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * GET /:slug - Get a single public organization by slug
 *
 * Returns detailed information about a specific public organization.
 */
publicOrganizationsRouter.get("/:slug", async (c) => {
  try {
    const { slug } = c.req.param();

    const org = await getPublicOrganizationBySlug(slug);

    if (!org) {
      return c.json({ error: "Organization not found" }, 404);
    }

    return c.json(org);
  } catch (error) {
    console.error("Failed to get public organization:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
