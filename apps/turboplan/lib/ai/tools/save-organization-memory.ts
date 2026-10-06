import { tool } from "ai";
import { z } from "zod";

import { getPrompt } from "@wildfires-org/turboplan-ai";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";
import { saveOrganizationMemory as saveMemory } from "@wildfires-org/turboplan-workspace/server";
import {
  ORGANIZATION_MEMORIES_MAX,
  ORGANIZATION_MEMORY_MAX_CHARS,
} from "@wildfires-org/turboplan-workspace/types";

import type { SaveOrganizationMemoryToolOutput } from "@/types/organization-context";

/**
 * Saves a short note to the organization that owns the chat's project, so
 * every later chat and research run in that organization sees it in the
 * organization context block.
 *
 * The organization is bound when the tool is created (resolved from the
 * project server-side) and is never taken from model input.
 */

interface SaveOrganizationMemoryProps {
  organizationId: string;
  organizationName: string;
  userId: string;
}

export const saveOrganizationMemory = async ({
  organizationId,
  organizationName,
  userId,
}: SaveOrganizationMemoryProps) => {
  const description = await getPrompt("tool-desc-save-organization-memory");

  return tool({
    description,
    inputSchema: z.object({
      content: z
        .string()
        .min(1)
        .max(ORGANIZATION_MEMORY_MAX_CHARS)
        .describe(
          "The note: one fact or preference as a plain statement, at most 3 short lines.",
        ),
    }),
    execute: async ({ content }): Promise<SaveOrganizationMemoryToolOutput> => {
      // Re-assert UPDATE permission at execution time — activeTools gating is a
      // convenience, this is the authoritative check before writing.
      const rbac = getRBACService();
      const permission = await rbac.checkPermission(
        userId,
        organizationId,
        EntityType.ORGANIZATION,
        Action.UPDATE,
      );
      if (!permission.allowed) {
        return { error: "Access denied." };
      }

      const result = await saveMemory({ organizationId, userId, content });

      switch (result.status) {
        case "created":
        case "duplicate":
          return {
            status: result.status === "created" ? "saved" : "already_saved",
            memory: { id: result.memory.id, content: result.memory.content },
            organizationName,
          };
        case "full":
          return {
            error: `Nothing was saved: the organization memory is full (${ORGANIZATION_MEMORIES_MAX} notes). The user can delete notes on the organization's Context page to make room.`,
          };
        case "too_long":
          return {
            error: `Nothing was saved: the note is longer than ${ORGANIZATION_MEMORY_MAX_CHARS} characters. Shorten it to one plain statement and try again.`,
          };
        case "empty":
          return {
            error:
              "Nothing was saved: the note is empty. Write the fact as one short plain statement.",
          };
      }
    },
  });
};
