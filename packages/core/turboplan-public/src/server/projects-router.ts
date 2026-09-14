/**
 * Public Projects Router
 *
 * Endpoints for fetching public project data without authentication.
 * Only returns data for projects that have isPublic=true.
 */

import { Hono } from "hono";

import {
  getGeneratedImageById,
  getGeneratedImageUrlsByIds,
} from "@wildfires-org/turboplan-db/queries";

import { getProjectBySlugs, getPublicProjects } from "../queries/projects";

export const publicProjectsRouter = new Hono();

/**
 * GET / - List all public projects
 *
 * Returns a list of all public projects with basic info for the gallery view.
 * Only returns projects that are:
 * - isPublic = true
 * - status = 'active' (not archived)
 * - isTemplate = false
 *
 * Optional query parameters:
 * - organizationId: Filter by organization UUID
 * - organizationSlug: Filter by organization slug
 * - officeId: Filter by office UUID
 * - officeSlug: Filter by office slug
 */
publicProjectsRouter.get("/", async (c) => {
  try {
    const publicProjects = await getPublicProjects({
      organizationId: c.req.query("organizationId"),
      organizationSlug: c.req.query("organizationSlug"),
      officeId: c.req.query("officeId"),
      officeSlug: c.req.query("officeSlug"),
    });

    // Batch-fetch cover image URLs in a single query
    const coverImageIds = publicProjects
      .map((p) => p.coverImageId)
      .filter((id): id is string => id !== null);

    const coverImageUrls = await getGeneratedImageUrlsByIds(coverImageIds);

    const result = publicProjects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      coverImageId: p.coverImageId,
      coverImageUrl: p.coverImageId
        ? (coverImageUrls.get(p.coverImageId) ?? null)
        : null,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
      office: {
        id: p.officeId,
        name: p.officeName,
        slug: p.officeSlug,
      },
      organization: {
        id: p.organizationId,
        name: p.organizationName,
        slug: p.organizationSlug,
      },
    }));

    return c.json(result);
  } catch (error) {
    console.error("Failed to get public projects:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * GET /:orgSlug/:officeSlug/:projectSlug - Get a single public project
 *
 * Returns detailed information about a specific public project.
 */
publicProjectsRouter.get("/:orgSlug/:officeSlug/:projectSlug", async (c) => {
  try {
    const { orgSlug, officeSlug, projectSlug } = c.req.param();

    const p = await getProjectBySlugs(orgSlug, officeSlug, projectSlug);

    if (!p) {
      return c.json({ error: "Project not found" }, 404);
    }

    if (!p.isPublic || p.status === "archived" || p.isTemplate) {
      return c.json({ error: "Project not found" }, 404);
    }

    let coverImageUrl: string | null = null;
    if (p.coverImageId) {
      try {
        const coverImage = await getGeneratedImageById(p.coverImageId);
        coverImageUrl = coverImage?.imageUrl ?? null;
      } catch {
        // Ignore cover image errors
      }
    }

    return c.json({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      coverImageId: p.coverImageId,
      coverImageUrl,
      startDate: p.startDate,
      endDate: p.endDate,
      updatedAt: p.updatedAt,
      createdAt: p.createdAt,
      office: {
        id: p.officeId,
        name: p.officeName,
        slug: p.officeSlug,
      },
      organization: {
        id: p.organizationId,
        name: p.organizationName,
        slug: p.organizationSlug,
      },
    });
  } catch (error) {
    console.error("Failed to get public project:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
