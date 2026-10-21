/**
 * Office and organization default letterhead grids
 * (`document_letterhead_grid`). Mounted on `/api/organizations` with
 * `:organizationId`, and on `/api/offices` with `:officeId`:
 * - GET    /:id/letterhead-grid               - `{ grid, version }` (READ)
 * - GET    /:id/letterhead-grid/logo?index=n  - one logo's bytes, 204 (READ)
 * - PUT    /:id/letterhead-grid               - edit `{ grid, version }`
 *          (UPDATE); 409 when the grid is no longer `version`
 * - DELETE /:id/letterhead-grid               - remove (UPDATE)
 * - POST   /:id/letterhead-grid/from-document - save a document's copy
 *          `{ projectId, documentId }` (UPDATE + project READ)
 * UPDATE is what the org/office document-branding fields (`PUT /:id`)
 * require. Every response sends the grid in its public form — logo cells by
 * `index`, never a storage key — and every success the grid's `version` (a
 * 16-hex-character hash of the stored grid, null when none is set), which
 * the editor sends back with its PUT.
 *
 * And on `/api/projects`:
 * - GET /:projectId/letterhead-target - where "Save as organization
 *   letterhead" can go for this project's documents (READ)
 */

import { type Context, Hono } from "hono";
import { z } from "zod";

import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  getRBACServiceForRequest,
  type RBACContext,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";

import { parseLetterheadLogoIndex } from "../../letterhead-grid";
import {
  gridLetterheadEditSchema,
  LETTERHEAD_EDIT_CONFLICT_ERROR,
} from "../../letterhead-grid-edit";
import {
  type DefaultLetterheadGridOwner,
  editDefaultLetterheadGrid,
  getDefaultLetterheadGridLogo,
  getProjectLetterheadTarget,
  getPublicDefaultLetterheadGrid,
  removeDefaultLetterheadGrid,
  saveDocumentLetterheadAsDefault,
} from "../default-letterhead-grid";

const uuidSchema = z.string().uuid();

const fromDocumentBodySchema = z.object({
  projectId: z.string().uuid(),
  documentId: z.string().uuid(),
});

// The edited grid is parsed with `gridLetterheadEditSchema` on its own, as
// `PUT /api/documents/:documentId/letterhead/own` does. `version`: the one GET
// sent when the editor opened (null: no grid was set) — required.
const editBodySchema = z.object({
  grid: z.unknown(),
  version: z
    .string()
    .regex(/^[0-9a-f]{16}$/)
    .nullable(),
});

// A path id that is not a UUID never reaches the permission check: the
// guard answers 400, as for a missing id.
const uuidParam =
  (name: string) =>
  (c: Context<RBACContext>): string | null => {
    const value = c.req.param(name);
    return value && uuidSchema.safeParse(value).success ? value : null;
  };

// `index` of /letterhead-grid/logo, read as `GET
// /api/documents/letterhead-logo` reads it; a malformed one is a 400 before
// any permission check, as there.
const requireLogoIndex = async (
  c: Context<RBACContext>,
  next: () => Promise<void>,
) => {
  if (parseLetterheadLogoIndex(c.req.query("index")) === null) {
    return c.json({ error: "Invalid index" }, 400);
  }
  await next();
};

const createDefaultLetterheadGridRouter = (
  kind: DefaultLetterheadGridOwner["kind"],
) => {
  const entityType =
    kind === "organization" ? EntityType.ORGANIZATION : EntityType.OFFICE;
  const idParam = kind === "organization" ? "organizationId" : "officeId";
  const ownerNotFound = {
    error:
      kind === "organization" ? "Organization not found" : "Office not found",
  };
  const ownerOf = (c: Context<RBACContext>): DefaultLetterheadGridOwner => ({
    kind,
    id: c.req.param(idParam) as string,
  });
  const guard = (action: typeof Action.READ | typeof Action.UPDATE) =>
    requirePermission(entityType, action, uuidParam(idParam));
  const path = `/:${idParam}/letterhead-grid`;

  const router = new Hono<RBACContext>();

  router.get(path, guard(Action.READ), async (c) => {
    try {
      const result = await getPublicDefaultLetterheadGrid(ownerOf(c));
      if (!result) {
        return c.json(ownerNotFound, 404);
      }
      return c.json({ grid: result.grid, version: result.version });
    } catch (error) {
      console.error(`Failed to get ${kind} letterhead grid:`, error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  });

  // The settings preview's logos: never the storage key itself.
  router.get(
    `${path}/logo`,
    requireLogoIndex,
    guard(Action.READ),
    async (c) => {
      try {
        // Checked by `requireLogoIndex`.
        const index = parseLetterheadLogoIndex(c.req.query("index")) ?? 0;

        const logo = await getDefaultLetterheadGridLogo(ownerOf(c), index);
        if (!logo) {
          // No grid, no such logo cell, or an unsupported/unreachable source.
          return c.body(null, 204);
        }
        return new Response(Buffer.from(logo.data), {
          headers: { "Content-Type": logo.contentType },
        });
      } catch (error) {
        console.error(`Failed to get ${kind} letterhead grid logo:`, error);
        return c.json({ error: "Failed to fetch letterhead logo" }, 500);
      }
    },
  );

  // Body `{ grid, version }`, the grid in the letterhead editor's shape: logo
  // cells keep a stored logo by `index` or bring a new upload of the caller
  // by `url`. A malformed body (a missing or malformed `version` included) is
  // a 400 `Invalid request body`; a grid that is no longer `version` a 409
  // (its logo indexes may mean other logos now); an invalid grid a 400
  // naming the offending field — as for a document's copy. 200: the saved
  // grid and its new version.
  router.put(path, guard(Action.UPDATE), async (c) => {
    try {
      const body = editBodySchema.safeParse(
        await c.req.json().catch(() => null),
      );
      const grid = body.success
        ? gridLetterheadEditSchema.safeParse(body.data.grid)
        : null;
      if (!body.success || !grid?.success) {
        return c.json({ error: "Invalid request body" }, 400);
      }

      const result = await editDefaultLetterheadGrid({
        owner: ownerOf(c),
        edit: grid.data,
        version: body.data.version,
        userId: c.get("user").userId,
      });
      if (!result.ok) {
        switch (result.reason) {
          case "not_found":
            return c.json(ownerNotFound, 404);
          case "conflict":
            return c.json({ error: LETTERHEAD_EDIT_CONFLICT_ERROR }, 409);
          default:
            return c.json({ error: result.message, field: result.field }, 400);
        }
      }
      return c.json({ grid: result.grid, version: result.version });
    } catch (error) {
      console.error(`Failed to update ${kind} letterhead grid:`, error);
      return c.json({ error: "Failed to update letterhead" }, 500);
    }
  });

  // The legacy letterhead fields take over again. Logo objects are left in
  // storage: document copies may still use them.
  router.delete(path, guard(Action.UPDATE), async (c) => {
    try {
      if (!(await removeDefaultLetterheadGrid(ownerOf(c)))) {
        return c.json(ownerNotFound, 404);
      }
      return c.json({ grid: null, version: null });
    } catch (error) {
      console.error(`Failed to remove ${kind} letterhead grid:`, error);
      return c.json({ error: "Failed to update letterhead" }, 500);
    }
  });

  // Save a document's own copy of its reference's letterhead as the default.
  // After UPDATE here, READ on the project; then one 404 (the same body as
  // the document letterhead routes) when the project is not under this
  // office/organization, the document is not in the project, or it has no
  // valid copy.
  router.post(`${path}/from-document`, guard(Action.UPDATE), async (c) => {
    try {
      const body = fromDocumentBodySchema.safeParse(
        await c.req.json().catch(() => null),
      );
      if (!body.success) {
        return c.json({ error: "Invalid request body" }, 400);
      }

      const { projectId, documentId } = body.data;
      const denied = await requirePermission(
        EntityType.PROJECT,
        Action.READ,
        () => projectId,
      )(c, async () => {});
      if (denied) {
        return denied;
      }

      const result = await saveDocumentLetterheadAsDefault({
        owner: ownerOf(c),
        projectId,
        documentId,
      });
      if (!result.ok) {
        return c.json({ error: "Document or letterhead not found" }, 404);
      }
      return c.json({ grid: result.grid, version: result.version });
    } catch (error) {
      console.error(`Failed to save ${kind} letterhead grid:`, error);
      return c.json({ error: "Failed to update letterhead" }, 500);
    }
  });

  return router;
};

export const organizationLetterheadGridRouter =
  createDefaultLetterheadGridRouter("organization");
export const officeLetterheadGridRouter =
  createDefaultLetterheadGridRouter("office");

export const projectLetterheadTargetRouter = new Hono<RBACContext>();

// `{ organizationId, officeId, officeHasOwnDefault, canEditOrganization,
// canEditOffice }`: with `officeHasOwnDefault` the organization's default is
// hidden from this project's documents (office → org resolution), so the UI
// offers the office instead. The can* flags are the UPDATE checks of the
// routes above.
projectLetterheadTargetRouter.get(
  "/:projectId/letterhead-target",
  requirePermission(EntityType.PROJECT, Action.READ, uuidParam("projectId")),
  async (c) => {
    try {
      const target = await getProjectLetterheadTarget(
        c.req.param("projectId") as string,
      );
      if (!target) {
        return c.json({ error: "Project not found" }, 404);
      }

      const user = c.get("user");
      const rbac = getRBACServiceForRequest(c);
      const [organization, office] = await Promise.all([
        rbac.checkPermission(
          user.userId,
          target.organizationId,
          EntityType.ORGANIZATION,
          Action.UPDATE,
          { email: user.email },
        ),
        rbac.checkPermission(
          user.userId,
          target.officeId,
          EntityType.OFFICE,
          Action.UPDATE,
          { email: user.email },
        ),
      ]);

      return c.json({
        ...target,
        canEditOrganization: organization.allowed,
        canEditOffice: office.allowed,
      });
    } catch (error) {
      console.error("Failed to get project letterhead target:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);
