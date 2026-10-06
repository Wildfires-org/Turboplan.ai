/**
 * Organization memory API routes, mounted at `/api/organization-memories`:
 * - DELETE /api/organization-memories/:id - Delete one memory (UPDATE)
 *
 * Memories are listed through `GET /api/organizations/:id/memories` and
 * created only by the chat tool (`saveOrganizationMemory`), so there is no
 * POST. A malformed or unknown id answers the same 403 as a denial, so memory
 * ids cannot be probed.
 */

import { type Context, Hono } from "hono";
import { z } from "zod";

import {
  deleteOrganizationMemory,
  getOrganizationMemoryById,
} from "@wildfires-org/turboplan-db/queries";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  type RBACContext,
  requireEntityPermission,
} from "@wildfires-org/turboplan-rbac/hono";

const uuidSchema = z.string().uuid();

/**
 * The organization owning the memory in the `:id` param, or null (→ the
 * guard's uniform 403) when the id is malformed or matches no memory.
 */
const organizationIdFromMemory = async (
  c: Context<RBACContext>,
): Promise<string | null> => {
  const parseResult = uuidSchema.safeParse(c.req.param("id"));
  if (!parseResult.success) {
    return null;
  }

  const memory = await getOrganizationMemoryById(parseResult.data);
  return memory?.organizationId ?? null;
};

export const organizationMemoriesRouter = new Hono<RBACContext>();

// DELETE /:id - Delete a memory (owner/editor of its organization)
organizationMemoriesRouter.delete(
  "/:id",
  requireEntityPermission(
    EntityType.ORGANIZATION,
    Action.UPDATE,
    organizationIdFromMemory,
  ),
  async (c) => {
    try {
      const deleted = await deleteOrganizationMemory(
        c.req.param("id") as string,
      );
      if (!deleted) {
        return c.json({ error: "Memory not found" }, 404);
      }

      return c.json({ success: true });
    } catch (error) {
      console.error("Failed to delete organization memory:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);
