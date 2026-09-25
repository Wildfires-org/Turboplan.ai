import { eq } from "drizzle-orm";
import { Hono } from "hono";

import { assertProjectCreationAllowed } from "@wildfires-org/turboplan-billing/server";
import { user as userTable } from "@wildfires-org/turboplan-db";
import {
  db,
  runWithWorkerConnection,
} from "@wildfires-org/turboplan-db/db-client";
import { getApiEnv } from "@wildfires-org/turboplan-env";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  getRBACServiceForRequest,
  type RBACContext,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";

import { getOfficeBySlug } from "../offices/queries";
import { getOrCreatePersonalWorkspace } from "../organizations/personal-workspace";
import { resolveTemplateIsPublic } from "../projects/creation-policy";
import {
  createProjectFromTemplate,
  createTemplateFromProject,
  getProjectById,
} from "../projects/queries";
import { getPubliclyRestrictedModules } from "../projects/template-copy-policy";
import { createProjectFromTemplateSchema } from "../projects/validation";

export const projectTemplatesRouter = new Hono<RBACContext>();

// POST /:id/create-template - Create template from project (RBAC: UPDATE on source + CREATE on office;
// a public template additionally needs MANAGE_MEMBERS on the office, otherwise it is private)
projectTemplatesRouter.post(
  "/:id/create-template",
  requirePermission(
    EntityType.PROJECT,
    Action.UPDATE,
    (c) => c.req.param("id")!,
  ),
  async (c) => {
    try {
      const sourceId = c.req.param("id")!;
      const user = c.get("user");

      if (!user?.userId) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Verify source project exists
      const sourceProject = await getProjectById(sourceId);
      if (!sourceProject) {
        return c.json({ error: "Project not found" }, 404);
      }

      // Check CREATE permission on the parent office
      const rbacService = getRBACServiceForRequest(c);
      const permissionResult = await rbacService.checkPermission(
        user.userId,
        sourceProject.officeId,
        EntityType.OFFICE,
        Action.CREATE,
      );

      if (!permissionResult.allowed) {
        return c.json(
          {
            error: "Forbidden",
            reason: permissionResult.reason,
          },
          403,
        );
      }

      // Parse optional overrides from request body
      let overrides: { name?: string; description?: string } | undefined;
      let requestedIsPublic: boolean | undefined;
      try {
        const body = await c.req.json();
        if (typeof body.isPublic === "boolean") {
          requestedIsPublic = body.isPublic;
        }
        if (body.name || body.description) {
          overrides = {
            name: body.name ? String(body.name) : undefined,
            description: body.description
              ? String(body.description)
              : undefined,
          };
        }
      } catch {
        // No body or invalid JSON — use defaults
      }

      // Editors may save private templates; publishing one takes office
      // MANAGE_MEMBERS (same bar as creating/updating a public project).
      const hasOfficeManageMembers =
        requestedIsPublic !== false &&
        (
          await rbacService.checkPermission(
            user.userId,
            sourceProject.officeId,
            EntityType.OFFICE,
            Action.MANAGE_MEMBERS,
          )
        ).allowed;
      const isPublic = resolveTemplateIsPublic({
        hasOfficeManageMembers,
        requestedIsPublic,
      });

      // Create template from project
      const newTemplate = await createTemplateFromProject(
        sourceId,
        user.userId,
        isPublic,
        overrides,
      );

      // Auto-generate isometric cover image. Runs in the background so template
      // creation stays fast, but registered via waitUntil so the Workers runtime
      // keeps the isolate (and the background DB connection) alive until the
      // image finishes — a bare fire-and-forget gets reaped after the response.
      const ENV = getApiEnv();

      if (!ENV.DISABLE_AUTO_PROJECT_IMAGE_GENERATION) {
        const imageTask = runWithWorkerConnection(async () => {
          try {
            const { autoGenerateTemplateCoverImage } = await import(
              "@wildfires-org/turboplan-ai/server"
            );

            const result = await autoGenerateTemplateCoverImage(
              newTemplate.id,
              newTemplate.name,
              user.userId,
              newTemplate.description,
            );

            if (result.success) {
              console.log(
                `[Template Creation] Auto-generated cover image for template ${newTemplate.id}`,
              );
            } else {
              console.log(
                `[Template Creation] Failed to auto-generate cover image: ${result.error}`,
              );
            }
          } catch (error) {
            console.error(
              `[Template Creation] Image generation threw an exception for template ${newTemplate.id}:`,
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
              `[Template Creation] Unhandled error in image generation for template ${newTemplate.id}:`,
              error,
            ),
          );
        }
      }

      await createTimelineRecord({
        projectId: sourceId,
        userId: user.userId,
        entityType: "project",
        entityId: newTemplate.id,
        entityName: newTemplate.name,
        action: "created",
        metadata: { isTemplate: true },
      });

      return c.json(newTemplate, 201);
    } catch (error) {
      console.error("Failed to create template from project:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// POST /:id/create-from-template - Create project from template (RBAC: CREATE on target office)
projectTemplatesRouter.post("/:id/create-from-template", async (c) => {
  try {
    const templateId = c.req.param("id")!;
    const user = c.get("user");

    if (!user?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Verify template project exists
    const sourceTemplate = await getProjectById(templateId);
    if (!sourceTemplate) {
      return c.json({ error: "Template not found" }, 404);
    }

    if (!sourceTemplate.isTemplate) {
      return c.json({ error: "Source project is not a template" }, 400);
    }

    const rbacService = getRBACServiceForRequest(c);

    // Private templates require explicit READ access. A public template may be
    // cloned by anyone, but without READ the caller only gets the modules the
    // public template view shows — hidden/private module content stays behind.
    const sourceAccessResult = await rbacService.checkPermission(
      user.userId,
      templateId,
      EntityType.PROJECT,
      Action.READ,
    );

    if (!sourceAccessResult.allowed && !sourceTemplate.isPublic) {
      return c.json(
        {
          error: "Forbidden",
          reason: sourceAccessResult.reason,
        },
        403,
      );
    }

    const excludedModules = sourceAccessResult.allowed
      ? []
      : getPubliclyRestrictedModules(
          sourceTemplate.hiddenModules,
          sourceTemplate.privateModules,
        );

    const body = await c.req.json();
    const validationResult = createProjectFromTemplateSchema.safeParse(body);

    if (!validationResult.success) {
      return c.json(
        {
          error: "Validation failed",
          details: validationResult.error.issues,
        },
        400,
      );
    }

    // `submitTo` (a gov org/office) is NOT submitted to at creation: the project
    // always lands in the personal workspace. It is only saved on the project as
    // the default submit target for a later explicit submit-for-review.
    const { name, description, organizationSlug, officeSlug, submitTo } =
      validationResult.data;

    // DIRECT mode: gov-staff in-app flow. When both slugs are supplied the
    // project is created STRAIGHT INTO the chosen workspace office — resolve
    // the office, require CREATE on it, no personal workspace, no submit.
    if (organizationSlug && officeSlug) {
      const { entity: targetOffice } = await getOfficeBySlug(
        organizationSlug,
        officeSlug,
      );

      if (!targetOffice) {
        return c.json({ error: "Office not found" }, 404);
      }

      const createPermissionResult = await rbacService.checkPermission(
        user.userId,
        targetOffice.id,
        EntityType.OFFICE,
        Action.CREATE,
      );

      if (!createPermissionResult.allowed) {
        return c.json(
          {
            error: "Forbidden",
            reason: createPermissionResult.reason,
          },
          403,
        );
      }

      // Billing gate: same active-project limit as every other creation
      // surface — direct mode was the one ungated branch.
      const directEntitlement = await assertProjectCreationAllowed({
        organizationId: targetOffice.organizationId,
      });
      if (!directEntitlement.allowed) {
        return c.json(
          {
            error: "Upgrade required",
            code: "UPGRADE_REQUIRED",
            plan: directEntitlement.plan,
            activeProjects: directEntitlement.activeProjects,
            projectLimit: directEntitlement.projectLimit,
          },
          403,
        );
      }

      const directProject = await createProjectFromTemplate(
        templateId,
        user.userId,
        targetOffice.id,
        {
          name,
          description,
          excludedModules,
        },
      );

      await createTimelineRecord({
        projectId: directProject.id,
        userId: user.userId,
        entityType: "project",
        entityId: directProject.id,
        entityName: directProject.name,
        action: "created",
        metadata: { createdFromTemplate: true, templateId },
      });

      return c.json(
        {
          project: directProject,
          submitted: false,
          location: {
            organizationSlug,
            officeSlug,
            projectSlug: directProject.slug,
          },
        },
        201,
      );
    }

    // PERSONAL mode: projects are created as DRAFTs in the citizen's own
    // PERSONAL workspace (they own it), then optionally submitted to a gov
    // org/office via the shared submit flow. No CREATE check on a gov office.
    let email = user.email;
    if (!email) {
      const [row] = await db
        .select({ email: userTable.email })
        .from(userTable)
        .where(eq(userTable.id, user.userId))
        .limit(1);
      email = row?.email;
    }

    const { organization: personalOrg, office: personalOffice } =
      await getOrCreatePersonalWorkspace(user.userId, email);

    // Billing gate BEFORE creation: template instantiation is project creation
    // and must respect the plan's active-project limit — the old count-only,
    // never-blocking behavior would let a Starter org exceed its limit through
    // templates. Same UPGRADE_REQUIRED contract as the direct creation route.
    const entitlement = await assertProjectCreationAllowed({
      organizationId: personalOrg.id,
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

    const createdProject = await createProjectFromTemplate(
      templateId,
      user.userId,
      personalOffice.id,
      {
        name,
        description,
        // Save the chosen agency as the default submit target (not submitted now).
        intendedSubmissionOrganizationId: submitTo?.organizationId ?? null,
        intendedSubmissionOfficeId: submitTo?.officeId ?? null,
        excludedModules,
      },
    );

    await createTimelineRecord({
      projectId: createdProject.id,
      userId: user.userId,
      entityType: "project",
      entityId: createdProject.id,
      entityName: createdProject.name,
      action: "created",
      metadata: { createdFromTemplate: true, templateId },
    });

    // The project always stays in the user's PERSONAL workspace at creation. The
    // gov org/office in `submitTo` is NOT submitted to here — it is only a
    // client-side default for an explicit submit-for-review action later. So the
    // response location is always the personal-workspace location and `submitted`
    // is always false.
    const location = {
      organizationSlug: personalOrg.slug,
      officeSlug: personalOffice.slug,
      projectSlug: createdProject.slug,
    };

    return c.json({ project: createdProject, submitted: false, location }, 201);
  } catch (error) {
    console.error("Failed to create project from template:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
