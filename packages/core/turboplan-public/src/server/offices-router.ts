/**
 * Public Offices Router
 *
 * Endpoints for fetching offices without authentication.
 * Used for signup dropdowns to select office affiliation.
 */

import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import { OrganizationStatus, organization } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

import {
  getActiveGovernmentOffices,
  getPaginatedOfficesByOrganizationId,
  getPublicOfficeBySlug,
} from "../queries/offices";
import {
  isPubliclyListedOrganizationType,
  organizationHasPublicProject,
  organizationIsBrowsable,
} from "../queries/public-visibility";

export const publicOfficesRouter = new Hono();

/**
 * GET /government - List all offices from government organizations
 *
 * Returns all active offices that belong to government organizations.
 * Used for title generation where we need all offices with their org info.
 *
 * Returns: name, organizationName, organizationShortName
 */
publicOfficesRouter.get("/government", async (c) => {
  try {
    const offices = await getActiveGovernmentOffices();
    return c.json(offices);
  } catch (error) {
    console.error("Failed to get government offices:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * GET / - List offices for an organization
 *
 * Returns a list of offices for signup dropdowns.
 * Only returns offices that are:
 * - status = 'active'
 *
 * Required query parameter:
 * - organizationId: UUID of the parent organization
 *
 * Optional query parameters:
 * - limit: Maximum number of offices to return (default: all)
 * - offset: Number of offices to skip (default: 0)
 *
 * Returns paginated response with total count when limit is specified.
 */
publicOfficesRouter.get("/", async (c) => {
  try {
    const organizationId = c.req.query("organizationId");
    const limitParam = c.req.query("limit");
    const offsetParam = c.req.query("offset");

    if (!organizationId) {
      return c.json({ error: "organizationId is required" }, 400);
    }

    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    // Verify the organization exists, is active, and is browsable: a listed
    // type, or any org that currently has a public project. Without this gate
    // the offices of any private org are enumerable by UUID.
    const [org] = await db
      .select({ id: organization.id, type: organization.type })
      .from(organization)
      .where(
        and(
          eq(organization.id, organizationId),
          eq(organization.status, OrganizationStatus.ACTIVE),
          organizationIsBrowsable(organizationHasPublicProject()),
        ),
      )
      .limit(1);

    if (!org) {
      return c.json({ error: "Organization not found" }, 404);
    }

    const result = await getPaginatedOfficesByOrganizationId(organizationId, {
      limit,
      offset,
      onlyWithPublicProjects: !isPubliclyListedOrganizationType(org.type),
    });
    return c.json(result);
  } catch (error) {
    console.error("Failed to get public offices:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * GET /:orgSlug/:officeSlug - Get a single office by slug
 *
 * Returns a single active office with organization info for catalog display.
 */
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/;

publicOfficesRouter.get("/:orgSlug/:officeSlug", async (c) => {
  try {
    const { orgSlug, officeSlug } = c.req.param();

    if (!SLUG_RE.test(orgSlug) || !SLUG_RE.test(officeSlug)) {
      return c.json({ error: "Invalid slug" }, 400);
    }

    const result = await getPublicOfficeBySlug(orgSlug, officeSlug);

    if (!result) {
      return c.json({ error: "Office not found" }, 404);
    }

    return c.json(result);
  } catch (error) {
    console.error("Failed to get public office by slug:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
