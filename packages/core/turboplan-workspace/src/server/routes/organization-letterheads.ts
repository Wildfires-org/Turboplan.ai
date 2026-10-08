/**
 * Organization letterhead library, mounted on `/api/organizations`:
 * - GET    /:organizationId/letterheads               - List (READ)
 * - POST   /:organizationId/letterheads               - Create (UPDATE)
 * - PUT    /:organizationId/letterheads/:letterheadId - Replace (UPDATE)
 * - DELETE /:organizationId/letterheads/:letterheadId - Delete (UPDATE)
 *
 * Deleting a letterhead cascades to the documents that selected it, which fall
 * back to the default letterhead. Logo blobs are not deleted: the same upload
 * may also back the org/office document logo or another letterhead.
 */

import { type Context, Hono } from "hono";
import { z } from "zod";

import {
  countDocumentLetterheads,
  createDocumentLetterhead,
  type DocumentLetterheadFields,
  deleteDocumentLetterhead,
  getDocumentLetterheadById,
  listDocumentLetterheads,
  updateDocumentLetterhead,
} from "@wildfires-org/turboplan-db/queries";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  type RBACContext,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";
import {
  isAllowedStorageUrlUpdate,
  isStorageUrl,
  type StorageOwner,
} from "@wildfires-org/turboplan-upload/server";

import {
  MAX_LIBRARY_LETTERHEADS,
  normalizeLetterheadColor,
} from "../../letterhead";
import { libraryLetterheadSchema } from "../organizations/letterhead-validation";
import { toLibraryLetterhead } from "../organizations/letterheads";

const uuidSchema = z.string().uuid();

const organizationIdParam = (c: Context<RBACContext>) =>
  c.req.param("organizationId") ?? null;

type ParsedBody =
  | { fields: DocumentLetterheadFields; error?: undefined }
  | { fields?: undefined; error: Response };

/**
 * Validate the body. A logo must live in our storage (it is fetched
 * server-side for exports) and, like the org document logo, be an upload this
 * caller or organization owns; an unchanged URL is always accepted.
 */
const parseBody = async (
  c: Context<RBACContext>,
  currentLogoUrl: string | null,
): Promise<ParsedBody> => {
  const body = await c.req.json().catch(() => null);
  const result = libraryLetterheadSchema.safeParse(body);
  if (!result.success) {
    return {
      error: c.json(
        { error: "Validation failed", details: result.error.issues },
        400,
      ),
    };
  }

  const { logoUrl, color, ...rest } = result.data;
  const nextLogoUrl = logoUrl || null;
  const owner: StorageOwner = {
    userId: c.get("user").userId,
    organizationId: c.req.param("organizationId") as string,
  };
  if (
    nextLogoUrl &&
    (!isStorageUrl(nextLogoUrl) ||
      !isAllowedStorageUrlUpdate(nextLogoUrl, currentLogoUrl, owner))
  ) {
    return {
      error: c.json({ error: "Logo URL must reference your own uploads" }, 400),
    };
  }

  return {
    fields: {
      ...rest,
      logoUrl: nextLogoUrl,
      color: color === undefined ? undefined : normalizeLetterheadColor(color),
    },
  };
};

export const organizationLetterheadsRouter = new Hono<RBACContext>();

organizationLetterheadsRouter.get(
  "/:organizationId/letterheads",
  requirePermission(EntityType.ORGANIZATION, Action.READ, organizationIdParam),
  async (c) => {
    try {
      const rows = await listDocumentLetterheads(
        c.req.param("organizationId") as string,
      );
      return c.json({ letterheads: rows.map(toLibraryLetterhead) });
    } catch (error) {
      console.error("Failed to list organization letterheads:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

organizationLetterheadsRouter.post(
  "/:organizationId/letterheads",
  requirePermission(
    EntityType.ORGANIZATION,
    Action.UPDATE,
    organizationIdParam,
  ),
  async (c) => {
    try {
      const organizationId = c.req.param("organizationId") as string;
      const parsed = await parseBody(c, null);
      if (parsed.error) {
        return parsed.error;
      }

      if (
        (await countDocumentLetterheads(organizationId)) >=
        MAX_LIBRARY_LETTERHEADS
      ) {
        return c.json(
          {
            error: `An organization can keep at most ${MAX_LIBRARY_LETTERHEADS} letterheads`,
          },
          400,
        );
      }

      const row = await createDocumentLetterhead({
        organizationId,
        createdBy: c.get("user").userId,
        ...parsed.fields,
      });
      return c.json({ letterhead: toLibraryLetterhead(row) });
    } catch (error) {
      console.error("Failed to create organization letterhead:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

organizationLetterheadsRouter.put(
  "/:organizationId/letterheads/:letterheadId",
  requirePermission(
    EntityType.ORGANIZATION,
    Action.UPDATE,
    organizationIdParam,
  ),
  async (c) => {
    try {
      const organizationId = c.req.param("organizationId") as string;
      const letterheadId = uuidSchema.safeParse(c.req.param("letterheadId"));
      const existing = letterheadId.success
        ? await getDocumentLetterheadById(letterheadId.data)
        : null;
      if (!existing || existing.organizationId !== organizationId) {
        return c.json({ error: "Letterhead not found" }, 404);
      }

      const parsed = await parseBody(c, existing.logoUrl);
      if (parsed.error) {
        return parsed.error;
      }

      const row = await updateDocumentLetterhead(
        organizationId,
        existing.id,
        parsed.fields,
      );
      if (!row) {
        return c.json({ error: "Letterhead not found" }, 404);
      }
      return c.json({ letterhead: toLibraryLetterhead(row) });
    } catch (error) {
      console.error("Failed to update organization letterhead:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

organizationLetterheadsRouter.delete(
  "/:organizationId/letterheads/:letterheadId",
  requirePermission(
    EntityType.ORGANIZATION,
    Action.UPDATE,
    organizationIdParam,
  ),
  async (c) => {
    try {
      const letterheadId = uuidSchema.safeParse(c.req.param("letterheadId"));
      const deleted = letterheadId.success
        ? await deleteDocumentLetterhead(
            c.req.param("organizationId") as string,
            letterheadId.data,
          )
        : null;
      if (!deleted) {
        return c.json({ error: "Letterhead not found" }, 404);
      }
      return c.json({ success: true });
    } catch (error) {
      console.error("Failed to delete organization letterhead:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);
