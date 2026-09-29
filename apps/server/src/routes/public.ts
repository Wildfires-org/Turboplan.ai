/**
 * Public API routes - No authentication required
 *
 * These endpoints serve public project data for the landing page.
 * They only return data for projects that have isPublic=true.
 */

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";

import { optionalAuthMiddleware } from "@wildfires-org/turboplan-api-client/server";
import {
  milestones,
  office,
  organization,
  project,
  tasks,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  getCommentsByProjectId,
  getGeneratedImageById,
} from "@wildfires-org/turboplan-db/queries";
import { createMapRepository } from "@wildfires-org/turboplan-map/server";

export const publicRouter = new Hono();

/**
 * GET /public/projects - List all public projects
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
publicRouter.get("/projects", async (c) => {
  try {
    // Parse optional query parameters for filtering
    const organizationId = c.req.query("organizationId");
    const organizationSlug = c.req.query("organizationSlug");
    const officeId = c.req.query("officeId");
    const officeSlug = c.req.query("officeSlug");

    // Build WHERE conditions
    const conditions = [
      eq(project.isPublic, true),
      eq(project.status, "active"),
      eq(project.isTemplate, false),
    ];

    // Add optional filters
    if (organizationId) {
      conditions.push(eq(organization.id, organizationId));
    }
    if (organizationSlug) {
      conditions.push(eq(organization.slug, organizationSlug));
    }
    if (officeId) {
      conditions.push(eq(office.id, officeId));
    }
    if (officeSlug) {
      conditions.push(eq(office.slug, officeSlug));
    }

    const publicProjects = await db
      .select({
        id: project.id,
        name: project.name,
        slug: project.slug,
        description: project.description,
        coverImageId: project.coverImageId,
        endDate: project.endDate,
        updatedAt: project.updatedAt,
        createdAt: project.createdAt,
        // Office info
        officeId: office.id,
        officeName: office.name,
        officeSlug: office.slug,
        // Organization info
        organizationId: organization.id,
        organizationName: organization.name,
        organizationSlug: organization.slug,
        organizationLogoUrl: organization.logoUrl,
      })
      .from(project)
      .innerJoin(office, eq(project.officeId, office.id))
      .innerJoin(organization, eq(office.organizationId, organization.id))
      .where(and(...conditions))
      .orderBy(desc(project.updatedAt));

    // Fetch cover image URLs for all projects that have one
    const coverImageIds = publicProjects
      .map((p) => p.coverImageId)
      .filter((id): id is string => id !== null);

    const coverImageUrls = new Map<string, string>();
    if (coverImageIds.length > 0) {
      await Promise.all(
        coverImageIds.map(async (imageId) => {
          try {
            const image = await getGeneratedImageById(imageId);
            if (image?.imageUrl) {
              coverImageUrls.set(imageId, image.imageUrl);
            }
          } catch {
            // Ignore individual image errors
          }
        }),
      );
    }

    // Fetch milestone progress for all returned projects
    type MilestoneProgress = {
      totalSteps: number;
      completedSteps: number;
      currentStep: number;
      currentStepTitle: string;
    };

    const milestoneProgressByProject = new Map<string, MilestoneProgress>();
    const projectIds = publicProjects.map((p) => p.id);

    if (projectIds.length > 0) {
      const projectMilestones = await db
        .select({
          projectId: milestones.projectId,
          title: milestones.title,
          status: milestones.status,
          order: milestones.order,
        })
        .from(milestones)
        .where(inArray(milestones.projectId, projectIds));

      // Group milestones by projectId
      const milestonesByProject = new Map<string, typeof projectMilestones>();
      for (const milestone of projectMilestones) {
        if (!milestone.projectId) {
          continue;
        }
        if (!milestonesByProject.has(milestone.projectId)) {
          milestonesByProject.set(milestone.projectId, []);
        }
        milestonesByProject.get(milestone.projectId)!.push(milestone);
      }

      // Compute progress for each project
      for (const [projectId, group] of milestonesByProject) {
        const sorted = [...group].sort((a, b) => a.order - b.order);
        const totalSteps = sorted.length;
        const completedSteps = sorted.filter(
          (m) => m.status === "completed",
        ).length;

        const firstIncompleteIndex = sorted.findIndex(
          (m) => m.status !== "completed",
        );
        const allCompleted = firstIncompleteIndex === -1;

        milestoneProgressByProject.set(projectId, {
          totalSteps,
          completedSteps,
          currentStep: allCompleted ? totalSteps : firstIncompleteIndex + 1,
          currentStepTitle: allCompleted
            ? "Completed"
            : sorted[firstIncompleteIndex].title,
        });
      }
    }

    // Transform to a cleaner structure
    const result = publicProjects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      coverImageId: p.coverImageId,
      coverImageUrl: p.coverImageId
        ? (coverImageUrls.get(p.coverImageId) ?? null)
        : null,
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
        logoUrl: p.organizationLogoUrl,
      },
      milestoneProgress: milestoneProgressByProject.get(p.id) ?? null,
    }));

    return c.json(result);
  } catch (error) {
    console.error("Failed to get public projects:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * GET /public/projects/:orgSlug/:officeSlug/:projectSlug - Get a single public project
 *
 * Returns detailed information about a specific public project.
 */
publicRouter.get("/projects/:orgSlug/:officeSlug/:projectSlug", async (c) => {
  try {
    const { orgSlug, officeSlug, projectSlug } = c.req.param();

    // Fetch project with organization and office info
    const result = await db
      .select({
        // Project fields
        id: project.id,
        name: project.name,
        slug: project.slug,
        description: project.description,
        coverImageId: project.coverImageId,
        isPublic: project.isPublic,
        status: project.status,
        isTemplate: project.isTemplate,
        startDate: project.startDate,
        endDate: project.endDate,
        updatedAt: project.updatedAt,
        createdAt: project.createdAt,
        // Office fields
        officeId: office.id,
        officeName: office.name,
        officeSlug: office.slug,
        // Organization fields
        organizationId: organization.id,
        organizationName: organization.name,
        organizationSlug: organization.slug,
      })
      .from(project)
      .innerJoin(office, eq(project.officeId, office.id))
      .innerJoin(organization, eq(office.organizationId, organization.id))
      .where(
        and(
          eq(organization.slug, orgSlug),
          eq(office.slug, officeSlug),
          eq(project.slug, projectSlug),
        ),
      )
      .limit(1);

    if (result.length === 0) {
      return c.json({ error: "Project not found" }, 404);
    }

    const p = result[0];

    // Check if project is publicly accessible
    if (!p.isPublic || p.status === "archived" || p.isTemplate) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Fetch cover image URL if exists
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

/**
 * GET /public/images/:imageId - Redirect to the generated image
 *
 * Redirects to the actual image URL for cover images.
 * Only serves images that belong to public projects to prevent leaking
 * images from private projects.
 */
publicRouter.get("/images/:imageId", async (c) => {
  try {
    const imageId = c.req.param("imageId");

    // Verify the image belongs to a public project before serving
    const publicProjectWithImage = await db
      .select({ id: project.id })
      .from(project)
      .where(
        and(
          eq(project.coverImageId, imageId),
          eq(project.isPublic, true),
          eq(project.status, "active"),
          eq(project.isTemplate, false),
        ),
      )
      .limit(1);

    if (publicProjectWithImage.length === 0) {
      return c.json({ error: "Image not found" }, 404);
    }

    const image = await getGeneratedImageById(imageId);
    if (!image || !image.imageUrl) {
      return c.json({ error: "Image not found" }, 404);
    }

    return c.redirect(image.imageUrl, 302);
  } catch (error) {
    console.error("Failed to get image:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * GET /public/projects/:orgSlug/:officeSlug/:projectSlug/modules - Get public project modules
 *
 * Returns module data (map layers, tasks/milestones) for a public project.
 * Only returns data for modules that are not hidden by the project owner.
 */
publicRouter.get(
  "/projects/:orgSlug/:officeSlug/:projectSlug/modules",
  async (c) => {
    try {
      const { orgSlug, officeSlug, projectSlug } = c.req.param();

      // Fetch project with module settings
      const result = await db
        .select({
          id: project.id,
          isPublic: project.isPublic,
          status: project.status,
          isTemplate: project.isTemplate,
          hiddenModules: project.hiddenModules,
          privateModules: project.privateModules,
          moduleOrder: project.moduleOrder,
          moduleColumns: project.moduleColumns,
        })
        .from(project)
        .innerJoin(office, eq(project.officeId, office.id))
        .innerJoin(organization, eq(office.organizationId, organization.id))
        .where(
          and(
            eq(organization.slug, orgSlug),
            eq(office.slug, officeSlug),
            eq(project.slug, projectSlug),
          ),
        )
        .limit(1);

      if (result.length === 0) {
        return c.json({ error: "Project not found" }, 404);
      }

      const p = result[0];

      // Check if project is publicly accessible
      if (!p.isPublic || p.status === "archived" || p.isTemplate) {
        return c.json({ error: "Project not found" }, 404);
      }

      const hiddenModules = (p.hiddenModules as string[]) || [];
      const privateModules = (p.privateModules as string[]) || [];
      const moduleOrder = (p.moduleOrder as string[]) || [
        "map",
        "tasks",
        "documents",
      ];
      const moduleColumns =
        (p.moduleColumns as Record<string, "main" | "sidebar">) || {};

      // Helper to check if a module should be hidden from public view
      // A module is hidden from public if it's in hiddenModules OR privateModules
      const isModuleHiddenFromPublic = (moduleName: string) =>
        hiddenModules.includes(moduleName) ||
        privateModules.includes(moduleName);

      // Initialize response
      const modules: {
        map?: {
          layers: unknown[];
          isHidden: boolean;
        };
        tasks?: {
          milestones: unknown[];
          isHidden: boolean;
        };
        documents?: {
          isHidden: boolean;
        };
        moduleOrder: string[];
        moduleColumns: Record<string, "main" | "sidebar">;
      } = {
        moduleOrder,
        moduleColumns,
      };

      // Fetch map layers if not hidden from public
      const isMapHidden = isModuleHiddenFromPublic("map");
      if (!isMapHidden) {
        try {
          const mapRepository = createMapRepository();
          const layers = await mapRepository.getLayersWithFeaturesForProject(
            p.id,
          );
          modules.map = {
            layers,
            isHidden: false,
          };
        } catch (error) {
          console.error("Failed to fetch map layers:", error);
          modules.map = {
            layers: [],
            isHidden: false,
          };
        }
      } else {
        modules.map = {
          layers: [],
          isHidden: true,
        };
      }

      // Fetch tasks/milestones if not hidden from public
      const isTasksHidden = isModuleHiddenFromPublic("tasks");
      if (!isTasksHidden) {
        try {
          // Fetch milestones for this project
          const projectMilestones = await db
            .select({
              id: milestones.id,
              title: milestones.title,
              startDate: milestones.startDate,
              dueDate: milestones.dueDate,
              status: milestones.status,
              order: milestones.order,
            })
            .from(milestones)
            .where(eq(milestones.projectId, p.id))
            .orderBy(asc(milestones.order));

          // Fetch tasks for these milestones
          const milestoneIds = projectMilestones.map((m) => m.id);
          let projectTasks: {
            id: string;
            title: string;
            description: string | null;
            startDate: Date;
            dueDate: Date;
            status: string;
            order: number;
            milestoneId: string;
          }[] = [];

          if (milestoneIds.length > 0) {
            projectTasks = await db
              .select({
                id: tasks.id,
                title: tasks.title,
                description: tasks.description,
                startDate: tasks.startDate,
                dueDate: tasks.dueDate,
                status: tasks.status,
                order: tasks.order,
                milestoneId: tasks.milestoneId,
              })
              .from(tasks)
              .where(inArray(tasks.milestoneId, milestoneIds))
              .orderBy(asc(tasks.order));
          }

          // Group tasks by milestone
          const tasksByMilestone = new Map<string, typeof projectTasks>();
          for (const task of projectTasks) {
            if (!tasksByMilestone.has(task.milestoneId)) {
              tasksByMilestone.set(task.milestoneId, []);
            }
            tasksByMilestone.get(task.milestoneId)!.push(task);
          }

          // Build milestones with tasks
          const milestonesWithTasks = projectMilestones.map((milestone) => ({
            ...milestone,
            tasks: tasksByMilestone.get(milestone.id) || [],
          }));

          modules.tasks = {
            milestones: milestonesWithTasks,
            isHidden: false,
          };
        } catch (error) {
          console.error("Failed to fetch tasks:", error);
          modules.tasks = {
            milestones: [],
            isHidden: false,
          };
        }
      } else {
        modules.tasks = {
          milestones: [],
          isHidden: true,
        };
      }

      // Documents module (placeholder for future)
      const isDocumentsHidden = isModuleHiddenFromPublic("documents");
      modules.documents = {
        isHidden: isDocumentsHidden,
      };

      return c.json(modules);
    } catch (error) {
      console.error("Failed to get public project modules:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

/**
 * GET /public/projects/:orgSlug/:officeSlug/:projectSlug/comments - Get public comments
 *
 * Returns comments for a public project.
 * - Anonymous users: Only public comments (isPublic=true)
 * - Logged-in users: Public comments + their own private comments
 */
publicRouter.get(
  "/projects/:orgSlug/:officeSlug/:projectSlug/comments",
  optionalAuthMiddleware,
  async (c) => {
    try {
      const { orgSlug, officeSlug, projectSlug } = c.req.param();
      const user = c.get("user");

      // Fetch project to verify it exists and is public
      const result = await db
        .select({
          id: project.id,
          isPublic: project.isPublic,
          status: project.status,
          isTemplate: project.isTemplate,
          hiddenModules: project.hiddenModules,
          privateModules: project.privateModules,
        })
        .from(project)
        .innerJoin(office, eq(project.officeId, office.id))
        .innerJoin(organization, eq(office.organizationId, organization.id))
        .where(
          and(
            eq(organization.slug, orgSlug),
            eq(office.slug, officeSlug),
            eq(project.slug, projectSlug),
          ),
        )
        .limit(1);

      if (result.length === 0) {
        return c.json({ error: "Project not found" }, 404);
      }

      const p = result[0];

      // Check if project is publicly accessible
      if (!p.isPublic || p.status === "archived" || p.isTemplate) {
        return c.json({ error: "Project not found" }, 404);
      }

      // Check if comments module is hidden from public
      const hiddenModules = (p.hiddenModules as string[]) || [];
      const privateModules = (p.privateModules as string[]) || [];

      if (
        hiddenModules.includes("comments") ||
        privateModules.includes("comments")
      ) {
        return c.json({ comments: [], isHidden: true });
      }

      // Get comments: public + user's own private comments if logged in
      const comments = await getCommentsByProjectId({
        projectId: p.id,
        currentUserId: user?.userId,
        publicView: true,
      });

      return c.json({ comments, isHidden: false });
    } catch (error) {
      console.error("Failed to get public comments:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);
