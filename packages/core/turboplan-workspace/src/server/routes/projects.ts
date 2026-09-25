import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { assertProjectCreationAllowed } from "@wildfires-org/turboplan-billing/server";
import {
  isOwnershipStatusPubliclyVisible,
  OwnershipStatus,
  office,
  project,
} from "@wildfires-org/turboplan-db";
import {
  db,
  runWithWorkerConnection,
} from "@wildfires-org/turboplan-db/db-client";
import {
  getGeneratedImagesByEntity,
  getProfileByUserId,
  saveChat,
  updateProjectCoverImage,
} from "@wildfires-org/turboplan-db/queries";
import {
  OrganizationType,
  PUBLICLY_LISTED_ORG_TYPES,
} from "@wildfires-org/turboplan-db/types";
import { getApiEnv } from "@wildfires-org/turboplan-env";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  getRBACServiceForRequest,
  type RBACContext,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";
import {
  computeChanges,
  createTimelineRecord,
  projectFieldDefs,
} from "@wildfires-org/turboplan-timeline-records/server";
import { deleteFile } from "@wildfires-org/turboplan-upload/server";
import { generateUniqueSlug } from "@wildfires-org/turboplan-utils/server";

import { getOfficeBySlug } from "../offices/queries";
import { getOrganizationById } from "../organizations/queries";
import { resolveProjectCreationFlags } from "../projects/creation-policy";
import {
  createProject,
  deleteProject,
  generateUniqueProjectSlug,
  getOrGenerateEmptyStateSuggestions,
  getProjectById,
  getProjectsByOffice,
  getProjectsCreatedByUser,
  getProjectWithRelations,
  getUserAccessibleProjects,
  softDeleteProject,
  updateProject,
} from "../projects/queries";
import {
  createProjectServerSchema,
  projectFiltersSchema,
  updateProjectSchema,
} from "../projects/validation";
import {
  isDraftHiddenFromUser,
  mergePublicAndAccessibleProjects,
} from "../projects/visibility";
import { projectMembersRouter } from "./project-members";
import { projectModulesRouter } from "./project-modules";
import { projectSubmissionsRouter } from "./project-submissions";
import { projectTemplatesRouter } from "./project-templates";

export const projectsRouter = new Hono<RBACContext>();

// GET /my - List all projects created by the current user across all orgs
projectsRouter.get("/my", async (c) => {
  try {
    const user = c.get("user");
    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const projects = await getProjectsCreatedByUser(user.userId);
    return c.json(projects);
  } catch (error) {
    console.error("Failed to get user's projects:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET / - List projects (RBAC: READ on parent office via slugs)
// Accepts organizationSlug and officeSlug query params
projectsRouter.get("/", async (c) => {
  // NOTE: We manually check RBAC here because we need to resolve slugs first
  // to get the office ID for permission check
  try {
    const user = c.get("user");
    const organizationSlug = c.req.query("organizationSlug");
    const officeSlug = c.req.query("officeSlug");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!organizationSlug || !officeSlug) {
      return c.json(
        { error: "organizationSlug and officeSlug are required" },
        400,
      );
    }

    // Resolve slugs to get office
    const { entity: officeRecord } = await getOfficeBySlug(
      organizationSlug,
      officeSlug,
    );
    if (!officeRecord) {
      return c.json({ error: "Office not found" }, 404);
    }

    // The permission check and the org lookup both only need the resolved
    // office — run them in parallel (one round-trip instead of two).
    const rbacService = getRBACServiceForRequest(c);
    const [permissionResult, org] = await Promise.all([
      rbacService.checkPermission(
        user.userId,
        officeRecord.id,
        EntityType.OFFICE,
        Action.READ,
      ),
      // Publicly-listed orgs (government + environmental planning) are readable
      // by any authenticated user, so their project lists are visible without
      // membership.
      getOrganizationById(officeRecord.organizationId),
    ]);
    const isPubliclyListedOrg =
      org !== null &&
      PUBLICLY_LISTED_ORG_TYPES.includes(org.type as OrganizationType);
    // Drafts are creator-only in government orgs (pending citizen submissions).
    const isGovOrg = org?.type === OrganizationType.GOVERNMENT;

    if (!permissionResult.allowed && !isPubliclyListedOrg) {
      return c.json(
        {
          error: "Forbidden",
          reason: permissionResult.reason,
        },
        403,
      );
    }

    // Parse and validate query parameters
    const rawFilters = {
      status: c.req.query("status") || undefined,
      isTemplate:
        c.req.query("isTemplate") === "true"
          ? true
          : c.req.query("isTemplate") === "false"
            ? false
            : undefined,
      offset: c.req.query("offset")
        ? Number.parseInt(c.req.query("offset")!)
        : undefined,
      limit: c.req.query("limit")
        ? Number.parseInt(c.req.query("limit")!)
        : undefined,
      sortBy: c.req.query("sortBy") || undefined,
      sortOrder: c.req.query("sortOrder") || undefined,
      search: c.req.query("search") || undefined,
    };

    const validationResult = projectFiltersSchema.safeParse(rawFilters);
    if (!validationResult.success) {
      return c.json(
        {
          error: "Invalid query parameters",
          details: validationResult.error.issues,
        },
        400,
      );
    }

    const filters = validationResult.data;

    // Build shared query options from validated filters
    const queryOptions = {
      status: filters.status,
      isTemplate: filters.isTemplate,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    };

    // For publicly-listed orgs: always include public projects + user's own
    // projects. For other orgs: show only projects the user has RBAC access to.
    let projects;
    if (isPubliclyListedOrg) {
      const [publicProjects, userProjects] = await Promise.all([
        getProjectsByOffice(officeRecord.id, {
          ...queryOptions,
          isPublic: true,
        }),
        getUserAccessibleProjects(user.userId, officeRecord.id),
      ]);
      // Applications under review stay out of the public half of the list.
      const visiblePublicProjects = publicProjects.filter((p) =>
        isOwnershipStatusPubliclyVisible(p.ownershipStatus),
      );
      // Merge and deduplicate by project ID; public-only entries lose the
      // creator's email.
      projects = mergePublicAndAccessibleProjects(
        visiblePublicProjects,
        userProjects,
      );
    } else {
      projects = await getUserAccessibleProjects(user.userId, officeRecord.id);
    }

    // Draft visibility is org-type dependent: in government orgs drafts are
    // creator-only (they're pending citizen submissions); in non-gov orgs any
    // member with RBAC READ access may see them. Every project in this list is
    // already something the user can see at the office scope (public-gov or
    // RBAC-accessible), so pass hasRbacRead=true — the gov/non-gov distinction
    // is what drives the rule here.
    projects = projects.filter(
      (p) => !isDraftHiddenFromUser(p, user.userId, isGovOrg, true),
    );

    // Apply client-side filters
    let filteredProjects = projects;

    if (filters.status) {
      filteredProjects = filteredProjects.filter(
        (p) => p.status === filters.status,
      );
    }
    if (typeof filters.isTemplate === "boolean") {
      filteredProjects = filteredProjects.filter(
        (p) => p.isTemplate === filters.isTemplate,
      );
    }

    // Filter by createdBy if specified ("me" resolves to current user)
    const createdBy = c.req.query("createdBy");
    if (createdBy) {
      const createdByUserId = createdBy === "me" ? user.userId : createdBy;
      filteredProjects = filteredProjects.filter(
        (p) => p.createdBy === createdByUserId,
      );
    }

    return c.json(filteredProjects);
  } catch (error) {
    console.error("Failed to get projects:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// POST / - Create project (RBAC: CREATE on parent office)
// Accepts organizationSlug and officeSlug, resolves to officeId
projectsRouter.post("/", async (c) => {
  // NOTE: We manually check RBAC here because we need to verify CREATE permission
  // on the PARENT OFFICE (from request body), not the project (which doesn't exist yet).
  // This differs from other routes where requirePermission middleware can extract the entity ID from the path.
  try {
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json();

    // Validate request body with Zod schema (uses slugs)
    const validationResult = createProjectServerSchema.safeParse({
      ...body,
      createdBy: user.userId,
    });

    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400,
      );
    }

    const { organizationSlug, officeSlug, hasExistingProject, ...projectData } =
      validationResult.data;

    // Resolve slugs to get office (validates organization relationship)
    const { entity: officeRecord } = await getOfficeBySlug(
      organizationSlug,
      officeSlug,
    );
    if (!officeRecord) {
      return c.json({ error: "Office not found" }, 404);
    }

    // Verify user has CREATE permission for the office (requires owner/editor role)
    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      officeRecord.id,
      EntityType.OFFICE,
      Action.CREATE,
    );

    if (!permissionResult.allowed) {
      // Any authenticated user can create projects (applications) in government offices
      const org = await getOrganizationById(officeRecord.organizationId);
      if (org?.type !== OrganizationType.GOVERNMENT) {
        return c.json(
          {
            error: "Forbidden",
            reason: permissionResult.reason,
          },
          403,
        );
      }
    }

    // Generate slug from name
    const slug = await generateUniqueProjectSlug(
      officeRecord.id,
      projectData.name,
    );

    const hasOfficeCreate = permissionResult.allowed;
    const wantsPublicOrTemplate =
      projectData.isPublic === true || projectData.isTemplate === true;
    const hasOfficeManageMembers =
      hasOfficeCreate &&
      wantsPublicOrTemplate &&
      (
        await rbacService.checkPermission(
          user.userId,
          officeRecord.id,
          EntityType.OFFICE,
          Action.MANAGE_MEMBERS,
        )
      ).allowed;

    // The role only matters for staff creations (citizen → DRAFT, others →
    // ACCEPTED). Prefer userRole from the auth context (set from the API
    // token); fall back to a profile lookup for tokens that don't carry it
    // (e.g. e2e tests).
    const userRole = hasOfficeCreate
      ? (user.userRole ?? (await getProfileByUserId(user.userId))?.userRole)
      : undefined;
    const { ownershipStatus, isPublic, isTemplate } =
      resolveProjectCreationFlags({
        hasOfficeCreate,
        hasOfficeManageMembers,
        userRole,
        requestedIsPublic: projectData.isPublic,
        requestedIsTemplate: projectData.isTemplate,
      });

    // Billing gate: the org's plan caps active projects (e.g. Starter allows
    // one). Pure count check — nothing is consumed, so there is nothing to
    // refund if creation fails. No-op when billing is disabled.
    const entitlement = await assertProjectCreationAllowed({
      organizationId: officeRecord.organizationId,
    });
    if (!entitlement.allowed) {
      return c.json(
        {
          error: "Upgrade required",
          code: "UPGRADE_REQUIRED",
          plan: entitlement.plan,
          activeProjects: entitlement.activeProjects,
          projectLimit: entitlement.projectLimit,
        },
        403,
      );
    }

    // Create project with resolved officeId and generated slug.
    const newProject = await createProject({
      ...projectData,
      slug,
      officeId: officeRecord.id,
      ownershipStatus,
      isPublic,
      isTemplate,
      // Bringing an existing project skips the AI research phase.
      ...(hasExistingProject ? { isResearchPhaseCompleted: true } : {}),
    });

    // Auto-generate cover image if feature is enabled. Runs in the background
    // so project creation stays fast, but registered via waitUntil so the
    // Workers runtime keeps the isolate (and the background DB connection)
    // alive until the image finishes — a bare fire-and-forget gets reaped
    // after the response, which silently dropped images on Workers.
    const ENV = getApiEnv();

    if (!ENV.DISABLE_AUTO_PROJECT_IMAGE_GENERATION) {
      const imageTask = runWithWorkerConnection(async () => {
        try {
          const { autoGenerateProjectCoverImage } = await import(
            "@wildfires-org/turboplan-ai/server"
          );

          const result = await autoGenerateProjectCoverImage(
            newProject.id,
            newProject.name,
            user.userId,
          );

          if (result.success) {
            console.log(
              `[Project Creation] Auto-generated cover image for project ${newProject.id}`,
            );
          } else {
            console.log(
              `[Project Creation] Failed to auto-generate cover image: ${result.error}`,
            );
          }
        } catch (error) {
          console.error(
            `[Project Creation] Image generation threw an exception for project ${newProject.id}:`,
            error,
          );
        }
      });

      try {
        c.executionCtx.waitUntil(imageTask);
      } catch {
        // Non-Workers runtime (e.g. Bun) has no executionCtx — the background
        // promise survives on its own; just swallow late errors.
        imageTask.catch((error) =>
          console.error(
            `[Project Creation] Unhandled error in image generation for project ${newProject.id}:`,
            error,
          ),
        );
      }
    }

    // Create the initial chat for the project so the client can redirect
    // directly to it after creation (and the research agent has a chatId).
    const initialChatId = crypto.randomUUID();
    await saveChat({
      id: initialChatId,
      userId: user.userId,
      title: newProject.name,
      projectId: newProject.id,
      isInitial: true,
    });

    await createTimelineRecord({
      projectId: newProject.id,
      userId: user.userId,
      entityType: "project",
      entityId: newProject.id,
      entityName: newProject.name,
      action: "created",
    });

    return c.json({ ...newProject, initialChatId }, 201);
  } catch (error) {
    console.error("Failed to create project:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// GET /:id - Get single project (RBAC: READ, with government public project bypass)
projectsRouter.get("/:id", async (c) => {
  try {
    const user = c.get("user");
    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const id = c.req.param("id")!;
    const projectWithRelations = await getProjectWithRelations(id);

    if (!projectWithRelations) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Check RBAC permission
    const rbacService = getRBACServiceForRequest(c);
    const permissionResult = await rbacService.checkPermission(
      user.userId,
      id,
      EntityType.PROJECT,
      Action.READ,
    );

    const proj = projectWithRelations.project;
    const isDraftFromOtherUser =
      proj.ownershipStatus === OwnershipStatus.DRAFT &&
      proj.createdBy !== user.userId;

    // Resolve the owning org's type once — needed for the public-listed READ
    // bypass and for the org-type-dependent draft rule. Only fetch when one of
    // those actually applies so the common member-read path stays a single query.
    let orgType: OrganizationType | null = null;
    if (!permissionResult.allowed || isDraftFromOtherUser) {
      const officeRecord = projectWithRelations.office;
      const org = officeRecord
        ? await getOrganizationById(officeRecord.organizationId)
        : null;
      orgType = (org?.type as OrganizationType) ?? null;
    }
    const isGovOrg = orgType === OrganizationType.GOVERNMENT;

    if (!permissionResult.allowed) {
      // Any authenticated user can view public projects in publicly-listed
      // offices (government + environmental planning).
      const isPublicListedOrgProject =
        proj.isPublic &&
        isOwnershipStatusPubliclyVisible(proj.ownershipStatus) &&
        orgType !== null &&
        PUBLICLY_LISTED_ORG_TYPES.includes(orgType);
      if (!isPublicListedOrgProject) {
        return c.json(
          {
            error: "Forbidden",
            reason: permissionResult.reason,
          },
          403,
        );
      }
    }

    // Draft visibility: creator-only in government orgs; in non-gov orgs any
    // member with RBAC READ access may see drafts. A user who only reached the
    // project via the public-gov bypass (READ denied) never sees others' drafts.
    if (
      isDraftHiddenFromUser(
        proj,
        user.userId,
        isGovOrg,
        permissionResult.allowed,
      )
    ) {
      return c.json({ error: "Project not found" }, 404);
    }

    return c.json(projectWithRelations);
  } catch (error) {
    console.error("Failed to get project:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// POST /:id/complete-research-phase - Mark research phase as completed (RBAC: UPDATE)
projectsRouter.post(
  "/:id/complete-research-phase",
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;

      await db
        .update(project)
        .set({ isResearchPhaseCompleted: true })
        .where(eq(project.id, id));

      return c.json({ success: true });
    } catch (error) {
      console.error("Failed to complete research phase:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  },
);

// PUT /:id - Update project (RBAC: UPDATE)
projectsRouter.put(
  "/:id",
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;
      const user = c.get("user");

      // Check if project exists
      const projectRecord = await getProjectById(id);
      if (!projectRecord) {
        return c.json({ error: "Project not found" }, 404);
      }

      const body = await c.req.json();

      // Validate request body with Zod schema
      const validationResult = updateProjectSchema.safeParse({
        ...body,
        id,
        lastModifiedBy: user.userId,
      });

      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const updateData = validationResult.data;

      // isPublic / isTemplate control catalogue + citizen-facing visibility.
      // Editors (UPDATE) can edit project content, but changing these requires
      // MANAGE_MEMBERS — the same bar per-module public visibility already uses.
      const changesPublicVisibility =
        updateData.isPublic !== undefined &&
        updateData.isPublic !== projectRecord.isPublic;
      const changesTemplateFlag =
        updateData.isTemplate !== undefined &&
        updateData.isTemplate !== projectRecord.isTemplate;

      if (changesPublicVisibility || changesTemplateFlag) {
        const elevated = await getRBACServiceForRequest(c).checkPermission(
          user.userId,
          id,
          EntityType.PROJECT,
          Action.MANAGE_MEMBERS,
        );
        if (!elevated.allowed) {
          return c.json(
            {
              error: "Forbidden",
              reason:
                "Changing public/template visibility requires MANAGE_MEMBERS",
            },
            403,
          );
        }
      }

      // Turning isPublic / isTemplate ON presents the project under the
      // office's name, so it takes MANAGE_MEMBERS on the office itself — the
      // same bar project creation uses for these flags. Project ownership alone
      // is not enough: the creator of a project is always its owner, so an
      // office editor could otherwise create it and then publish it with a
      // second request. Turning them OFF only needs project MANAGE_MEMBERS.
      const enablesPublicOrTemplate =
        (changesPublicVisibility && updateData.isPublic === true) ||
        (changesTemplateFlag && updateData.isTemplate === true);
      if (enablesPublicOrTemplate) {
        const officeElevated = await getRBACServiceForRequest(
          c,
        ).checkPermission(
          user.userId,
          projectRecord.officeId,
          EntityType.OFFICE,
          Action.MANAGE_MEMBERS,
          { email: user.email },
        );
        if (!officeElevated.allowed) {
          return c.json(
            {
              error: "Forbidden",
              reason:
                "Publishing a project or listing it as a template requires MANAGE_MEMBERS on its office",
            },
            403,
          );
        }
      }

      // Billing gate on template conversion: flipping isTemplate off turns
      // content into a real active project — same limit as creating one.
      if (updateData.isTemplate === false && projectRecord.isTemplate) {
        const [orgRow] = await db
          .select({ organizationId: office.organizationId })
          .from(office)
          .where(eq(office.id, projectRecord.officeId))
          .limit(1);
        if (orgRow) {
          const entitlement = await assertProjectCreationAllowed({
            organizationId: orgRow.organizationId,
          });
          if (!entitlement.allowed) {
            return c.json(
              {
                error: "Upgrade required",
                code: "UPGRADE_REQUIRED",
                plan: entitlement.plan,
                activeProjects: entitlement.activeProjects,
                projectLimit: entitlement.projectLimit,
              },
              403,
            );
          }
        }
      }

      // Generate new slug if name is changing
      let newSlug: string | undefined;
      if (updateData.name && updateData.name !== projectRecord.name) {
        newSlug = generateUniqueSlug(updateData.name);
      }

      // Fetch old project state for change detection
      const [oldProject] = await db
        .select()
        .from(project)
        .where(eq(project.id, id));

      await updateProject({ ...updateData, slug: newSlug });

      // Return updated project
      const updatedProject = await getProjectWithRelations(id);

      const changes = computeChanges(
        oldProject,
        updatedProject?.project ?? null,
        projectFieldDefs,
      );
      if (changes.length > 0) {
        await createTimelineRecord({
          projectId: id,
          userId: user.userId,
          entityType: "project",
          entityId: id,
          entityName: updatedProject?.project.name ?? "",
          action: "updated",
          changes,
        });
      }

      return c.json(updatedProject);
    } catch (error) {
      console.error("Failed to update project:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// PATCH /:id/cover-image - Update project cover image
projectsRouter.patch(
  "/:id/cover-image",
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;

      // Check if project exists
      const projectRecord = await getProjectById(id);
      if (!projectRecord) {
        return c.json({ error: "Project not found" }, 404);
      }

      const body = await c.req.json();
      const { imageId } = body;

      // Validate imageId
      if (imageId !== null && typeof imageId !== "string") {
        return c.json({ error: "Invalid imageId" }, 400);
      }

      // If imageId is provided, validate it exists and belongs to this project
      if (imageId) {
        const { getGeneratedImageById } = await import(
          "@wildfires-org/turboplan-db/queries"
        );
        const image = await getGeneratedImageById(imageId);

        if (!image) {
          return c.json({ error: "Image not found" }, 404);
        }

        if (image.entityId !== id) {
          return c.json(
            { error: "Image does not belong to this project" },
            400,
          );
        }
      }

      // Update project cover image using query from turboplan-db
      await updateProjectCoverImage(id, imageId);

      const user = c.get("user");

      await createTimelineRecord({
        projectId: id,
        userId: user.userId,
        entityType: "project",
        entityId: id,
        action: "updated",
        changes: [
          {
            field: "coverImageId",
            previousValue: null,
            newValue: imageId,
            valueType: "text",
          },
        ],
      });

      // Return updated project
      const updatedProject = await getProjectWithRelations(id);
      return c.json(updatedProject);
    } catch (error) {
      console.error("Failed to update project cover image:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// PATCH /:id/soft-delete - Soft delete project (RBAC: DELETE)
projectsRouter.patch(
  "/:id/soft-delete",
  requirePermission(
    EntityType.PROJECT,
    Action.DELETE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;
      const authUser = c.get("user");

      if (!authUser?.userId) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Check if project exists and is not already deleted
      const projectRecord = await getProjectById(id);
      if (!projectRecord) {
        return c.json({ error: "Project not found" }, 404);
      }

      await softDeleteProject(id, authUser.userId);
      return c.json({ message: "Project deleted successfully" });
    } catch (error) {
      console.error("Failed to soft delete project:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// DELETE /:id - Delete project (RBAC: DELETE)
projectsRouter.delete(
  "/:id",
  requirePermission(
    EntityType.PROJECT,
    Action.DELETE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const id = c.req.param("id")!;

      // Check if project exists
      const projectRecord = await getProjectById(id);
      if (!projectRecord) {
        return c.json({ error: "Project not found" }, 404);
      }

      // Fetch images before deletion to cleanup blobs later
      const imagesToDelete = await getGeneratedImagesByEntity(id, "project");

      // Delete project (cascades to timeline records and other related DB records)
      await deleteProject(id);

      // Then cleanup blob files (non-critical if fails)
      if (imagesToDelete.length > 0) {
        try {
          const imageUrls = imagesToDelete.map((image) => image.imageUrl);
          await Promise.allSettled(imageUrls.map((url) => deleteFile(url)));
        } catch (error) {
          console.error("Error cleaning up blob files:", error);
          // Log but don't fail - blobs can be cleaned up later
        }
      }
      return c.json({ message: "Project deleted successfully" });
    } catch (error) {
      console.error("Failed to delete project:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// GET /:id/generated-images - Get generated images for project (RBAC: READ)
projectsRouter.get(
  "/:id/generated-images",
  requirePermission(EntityType.PROJECT, Action.READ, (c) => c.req.param("id")!),
  async (c) => {
    try {
      const projectId = c.req.param("id")!;
      const projectRecord = await getProjectById(projectId);
      if (!projectRecord) {
        return c.json({ error: "Project not found" }, 404);
      }

      // Import generated images queries
      const images = await getGeneratedImagesByEntity(projectId, "project");

      return c.json({ images });
    } catch (error) {
      console.error("Error fetching generated images:", error);
      return c.json({ error: "Failed to fetch images" }, 500);
    }
  },
);

// GET /:id/empty-state-suggestions - Get AI-generated empty state suggestion pills (RBAC: READ)
projectsRouter.get(
  "/:id/empty-state-suggestions",
  requirePermission(EntityType.PROJECT, Action.READ, (c) => c.req.param("id")!),
  async (c) => {
    try {
      const projectId = c.req.param("id")!;
      const section = c.req.query("section");

      if (section !== "tasks" && section !== "documents") {
        return c.json(
          { error: "section query parameter must be 'tasks' or 'documents'" },
          400,
        );
      }

      const suggestions = await getOrGenerateEmptyStateSuggestions({
        projectId,
        section,
      });

      return c.json(suggestions);
    } catch (error) {
      console.error("Failed to get empty state suggestions:", error);
      return c.json([], 200);
    }
  },
);

// Mount sub-routers
projectsRouter.route("/", projectSubmissionsRouter);
projectsRouter.route("/", projectTemplatesRouter);
projectsRouter.route("/", projectModulesRouter);
projectsRouter.route("/", projectMembersRouter);
