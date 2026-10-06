/**
 * Organization context API routes (the organization's standing AI prompt and
 * its memories), mounted on `/api/organizations`:
 * - GET /api/organizations/:id/context - The prompt (READ)
 * - PUT /api/organizations/:id/context - Create or replace the prompt (UPDATE)
 * - GET /api/organizations/:id/memories - Memories saved from chats (READ)
 *
 * Both context routes answer `{ prompt, updatedAt }`; an organization that
 * never saved a prompt reads as `{ prompt: "", updatedAt: null }`. Memories
 * are created only by the chat tool and deleted through
 * `/api/organization-memories/:id`.
 */

import { Hono } from "hono";

import {
  getOrganizationPrompt,
  listOrganizationMemories,
  upsertOrganizationPrompt,
} from "@wildfires-org/turboplan-db/queries";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import {
  type RBACContext,
  requirePermission,
} from "@wildfires-org/turboplan-rbac/hono";

import type { OrganizationMemory } from "../../types";
import { updateOrganizationPromptSchema } from "../organizations/context-validation";

export const organizationContextRouter = new Hono<RBACContext>();

// GET /:id/context - The organization's standing prompt
organizationContextRouter.get(
  "/:id/context",
  requirePermission(
    EntityType.ORGANIZATION,
    Action.READ,
    (c) => c.req.param("id") ?? null,
  ),
  async (c) => {
    try {
      const organizationId = c.req.param("id") as string;
      const context = await getOrganizationPrompt(organizationId);

      return c.json({
        prompt: context?.prompt ?? "",
        updatedAt: context?.updatedAt ?? null,
      });
    } catch (error) {
      console.error("Failed to get organization context:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// PUT /:id/context - Create or replace the standing prompt (owner/editor)
organizationContextRouter.put(
  "/:id/context",
  requirePermission(
    EntityType.ORGANIZATION,
    Action.UPDATE,
    (c) => c.req.param("id") ?? null,
  ),
  async (c) => {
    try {
      const organizationId = c.req.param("id") as string;
      const user = c.get("user");

      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "Invalid JSON body" }, 400);
      }

      const validationResult = updateOrganizationPromptSchema.safeParse(body);
      if (!validationResult.success) {
        return c.json(
          {
            error: "Validation failed",
            details: validationResult.error.issues,
          },
          400,
        );
      }

      const saved = await upsertOrganizationPrompt({
        organizationId,
        prompt: validationResult.data.prompt,
        userId: user.userId,
      });

      return c.json({ prompt: saved.prompt, updatedAt: saved.updatedAt });
    } catch (error) {
      console.error("Failed to update organization context:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);

// GET /:id/memories - Memories saved from chats, newest first
organizationContextRouter.get(
  "/:id/memories",
  requirePermission(
    EntityType.ORGANIZATION,
    Action.READ,
    (c) => c.req.param("id") ?? null,
  ),
  async (c) => {
    try {
      const organizationId = c.req.param("id") as string;
      const memories: OrganizationMemory[] =
        await listOrganizationMemories(organizationId);

      return c.json({ memories });
    } catch (error) {
      console.error("Failed to list organization memories:", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }
  },
);
