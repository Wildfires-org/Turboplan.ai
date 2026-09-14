/**
 * Public Templates Router
 *
 * Endpoints for fetching public template data without authentication.
 * Only returns data for projects that have isPublic=true and isTemplate=true.
 */

import { Hono } from "hono";

import {
  getGeneratedImageById,
  getGeneratedImageUrlsByIds,
} from "@wildfires-org/turboplan-db/queries";

import {
  getDocumentsByProjectId,
  getFieldsByProjectId,
  getMilestonesWithTasks,
} from "../queries/modules";
import { getProjectBySlugs, getPublicTemplates } from "../queries/projects";

export const publicTemplatesRouter = new Hono();

type TemplateModulesResponse = {
  tasks?: {
    milestones: unknown[];
    isHidden: boolean;
  };
  fields?: {
    fields: unknown[];
    isHidden: boolean;
  };
  documents?: {
    documents: unknown[];
    isHidden: boolean;
  };
  moduleOrder: string[];
};

/**
 * GET / - List all public templates
 *
 * Returns a list of all public templates with basic info.
 * Only returns projects that are:
 * - isPublic = true
 * - status = 'active' (not archived)
 * - isTemplate = true
 *
 * Optional query parameters:
 * - organizationId: Filter by organization UUID
 * - organizationSlug: Filter by organization slug
 * - officeId: Filter by office UUID
 * - officeSlug: Filter by office slug
 * - limit: Maximum number of templates to return
 */
publicTemplatesRouter.get("/", async (c) => {
  try {
    const limitParam = c.req.query("limit");
    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

    // When limit is set, fetch one extra row to determine if there are more
    const fetchLimit = limit ? limit + 1 : undefined;

    const templates = await getPublicTemplates(
      {
        organizationId: c.req.query("organizationId"),
        organizationSlug: c.req.query("organizationSlug"),
        officeId: c.req.query("officeId"),
        officeSlug: c.req.query("officeSlug"),
      },
      fetchLimit,
    );

    const hasMore = limit ? templates.length > limit : false;
    const trimmed = limit ? templates.slice(0, limit) : templates;

    // Batch-fetch cover image URLs in a single query
    const coverImageIds = trimmed
      .map((t) => t.coverImageId)
      .filter((id): id is string => id !== null);

    const coverImageUrls = await getGeneratedImageUrlsByIds(coverImageIds);

    const items = trimmed.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      coverImageId: t.coverImageId,
      coverImageUrl: t.coverImageId
        ? (coverImageUrls.get(t.coverImageId) ?? null)
        : null,
      updatedAt: t.updatedAt,
      createdAt: t.createdAt,
      office: {
        id: t.officeId,
        name: t.officeName,
        slug: t.officeSlug,
      },
      organization: {
        id: t.organizationId,
        name: t.organizationName,
        slug: t.organizationSlug,
      },
    }));

    return c.json({ templates: items, hasMore });
  } catch (error) {
    console.error("Failed to get public templates:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * GET /:orgSlug/:officeSlug/:templateSlug - Get a single public template
 *
 * Returns detailed information about a specific public template.
 */
publicTemplatesRouter.get("/:orgSlug/:officeSlug/:templateSlug", async (c) => {
  try {
    const { orgSlug, officeSlug, templateSlug } = c.req.param();

    const p = await getProjectBySlugs(orgSlug, officeSlug, templateSlug);

    if (!p) {
      return c.json({ error: "Template not found" }, 404);
    }

    if (!p.isPublic || p.status === "archived" || !p.isTemplate) {
      return c.json({ error: "Template not found" }, 404);
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
    console.error("Failed to get public template:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * GET /:orgSlug/:officeSlug/:templateSlug/modules - Get public template modules
 *
 * Returns module data (map layers, tasks/milestones) for a public template.
 */
publicTemplatesRouter.get(
  "/:orgSlug/:officeSlug/:templateSlug/modules",
  async (c) => {
    try {
      const { orgSlug, officeSlug, templateSlug } = c.req.param();

      const p = await getProjectBySlugs(orgSlug, officeSlug, templateSlug);

      if (!p) {
        return c.json({ error: "Template not found" }, 404);
      }

      if (!p.isPublic || p.status === "archived" || !p.isTemplate) {
        return c.json({ error: "Template not found" }, 404);
      }

      const hiddenModules = (p.hiddenModules as string[]) || [];
      const privateModules = (p.privateModules as string[]) || [];
      const moduleOrder = (p.moduleOrder as string[]) || [
        "tasks",
        "fields",
        "documents",
      ];

      const isModuleHiddenFromPublic = (moduleName: string) =>
        hiddenModules.includes(moduleName) ||
        privateModules.includes(moduleName);

      const modules: TemplateModulesResponse = {
        moduleOrder,
      };

      const [tasks, fields, documents] = await Promise.all([
        fetchTasksModule(p.id, isModuleHiddenFromPublic("tasks")),
        fetchFieldsModule(p.id, isModuleHiddenFromPublic("fields")),
        fetchDocumentsModule(p.id, isModuleHiddenFromPublic("documents")),
      ]);

      modules.tasks = tasks;
      modules.fields = fields;
      modules.documents = documents;

      return c.json(modules);
    } catch (error) {
      console.error("Failed to get public template modules:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

async function fetchTasksModule(
  projectId: string,
  isHidden: boolean,
): Promise<TemplateModulesResponse["tasks"]> {
  if (isHidden) {
    return { milestones: [], isHidden: true };
  }

  try {
    const milestonesWithTasks = await getMilestonesWithTasks(projectId);
    return { milestones: milestonesWithTasks, isHidden: false };
  } catch (error) {
    console.error("Failed to fetch template tasks:", error);
    return { milestones: [], isHidden: false };
  }
}

async function fetchFieldsModule(
  projectId: string,
  isHidden: boolean,
): Promise<TemplateModulesResponse["fields"]> {
  if (isHidden) {
    return { fields: [], isHidden: true };
  }

  try {
    const fields = await getFieldsByProjectId(projectId);
    return { fields, isHidden: false };
  } catch (error) {
    console.error("Failed to fetch template fields:", error);
    return { fields: [], isHidden: false };
  }
}

async function fetchDocumentsModule(
  projectId: string,
  isHidden: boolean,
): Promise<TemplateModulesResponse["documents"]> {
  if (isHidden) {
    return { documents: [], isHidden: true };
  }

  try {
    const documents = await getDocumentsByProjectId(projectId);
    return { documents, isHidden: false };
  } catch (error) {
    console.error("Failed to fetch template documents:", error);
    return { documents: [], isHidden: false };
  }
}
