import { tool } from "ai";
import { z } from "zod";

import { getPrompt } from "@wildfires-org/turboplan-ai";
import { upsertProjectContextEntries } from "@wildfires-org/turboplan-project-context/server";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";
import { createTimelineRecord } from "@wildfires-org/turboplan-timeline-records/server";
import {
  HTTP_URL_ONLY_MESSAGE,
  isSafeHttpUrl,
} from "@wildfires-org/turboplan-utils/server";

/**
 * Upper bound on entries per call — keeps the sequential DB/timeline write
 * loop bounded against runaway model output.
 */
const MAX_ENTRIES_PER_CALL = 50;

interface UpdateProjectContextProps {
  projectId: string;
  userId: string;
}

export const updateProjectContext = async ({
  projectId,
  userId,
}: UpdateProjectContextProps) => {
  const description = await getPrompt("tool-desc-update-project-context");

  return tool({
    description,
    inputSchema: z.object({
      entries: z
        .array(
          z.object({
            label: z.string().min(1).max(200),
            content: z.string().min(1).max(50000),
            url: z
              .string()
              .url()
              .refine(isSafeHttpUrl, HTTP_URL_ONLY_MESSAGE)
              .optional(),
          }),
        )
        .min(1)
        .max(MAX_ENTRIES_PER_CALL),
    }),
    execute: async ({ entries }) => {
      // Re-assert UPDATE permission at execution time — activeTools gating is a
      // convenience, this is the authoritative check before writing.
      const rbac = getRBACService();
      const permission = await rbac.checkPermission(
        userId,
        projectId,
        EntityType.PROJECT,
        Action.UPDATE,
      );
      if (!permission.allowed) {
        return { error: "Access denied." };
      }

      // Dedupe input by normalized label (last-wins) so the upsert contract
      // holds within a single call: no duplicate inserts, no double updates.
      const dedupedEntries = [
        ...new Map(
          entries.map((entry) => [entry.label.trim().toLowerCase(), entry]),
        ).values(),
      ];

      // UPSERT by label (case-insensitive) — the repository serializes
      // concurrent calls per project so parallel tool calls cannot insert
      // duplicate labels.
      const { created, updated } = await upsertProjectContextEntries(
        projectId,
        dedupedEntries,
        userId,
      );

      for (const row of updated) {
        await createTimelineRecord({
          projectId,
          userId,
          entityType: "context",
          entityId: row.id,
          entityName: row.label,
          action: "updated",
        });
      }
      for (const row of created) {
        await createTimelineRecord({
          projectId,
          userId,
          entityType: "context",
          entityId: row.id,
          entityName: row.label,
          action: "created",
        });
      }

      return { created, updated };
    },
  });
};
