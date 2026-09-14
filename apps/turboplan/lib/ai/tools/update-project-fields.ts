import { tool } from "ai";
import { z } from "zod";

import { getPrompt } from "@wildfires-org/turboplan-ai";
import {
  createProjectFieldEntry,
  MAX_VALUES_PER_FIELD,
  updateProjectFieldValues,
} from "@wildfires-org/turboplan-fields/server";
import { Action, EntityType } from "@wildfires-org/turboplan-rbac";
import { getRBACService } from "@wildfires-org/turboplan-rbac/server";

/**
 * Upper bound on updates per call — keeps the sequential DB write loop
 * bounded against runaway model output.
 */
const MAX_UPDATES_PER_CALL = 50;

interface UpdateProjectFieldsProps {
  projectId: string;
  userId: string;
  /**
   * When true, append the proactive field-creation guidance to the tool
   * description. Set for projects brought in mid-stream (they skipped the AI
   * research phase, so their structured fields were never set up).
   */
  proactiveFieldCreation?: boolean;
}

export const updateProjectFields = async ({
  projectId,
  userId,
  proactiveFieldCreation,
}: UpdateProjectFieldsProps) => {
  const description = proactiveFieldCreation
    ? await Promise.all([
        getPrompt("tool-desc-update-project-fields"),
        getPrompt("tool-desc-update-project-fields-proactive"),
      ]).then(([base, proactive]) => `${base}\n\n${proactive}`)
    : await getPrompt("tool-desc-update-project-fields");

  return tool({
    description,
    inputSchema: z.object({
      updates: z
        .array(
          z.object({
            fieldId: z.string().uuid().optional(),
            name: z.string().min(1).max(100),
            type: z.enum(["text", "list"]).optional(),
            values: z.array(z.string().max(500)).max(MAX_VALUES_PER_FIELD),
          }),
        )
        .min(1)
        .max(MAX_UPDATES_PER_CALL),
    }),
    execute: async ({ updates }) => {
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

      const created: Array<{ id: string; name: string }> = [];
      const updated: Array<{ id: string; name: string }> = [];
      const skipped: Array<{ name: string; reason: string }> = [];

      for (const update of updates) {
        if (update.fieldId) {
          // Update path — helper verifies the field belongs to this project.
          const result = await updateProjectFieldValues({
            projectId,
            fieldId: update.fieldId,
            values: update.values,
            userId,
          });
          if (!result) {
            // Field id does not belong to this project. Report as not-found
            // without revealing whether it exists elsewhere.
            skipped.push({ name: update.name, reason: "not-found" });
            continue;
          }
          updated.push({ id: result.id, name: result.name });
        } else {
          // Create path — helper enforces MAX_FIELDS_PER_PROJECT.
          const result = await createProjectFieldEntry({
            projectId,
            name: update.name,
            type: update.type ?? "text",
            values: update.values,
            userId,
          });
          if (!result) {
            skipped.push({ name: update.name, reason: "field-limit-reached" });
            continue;
          }
          created.push({ id: result.id, name: result.name });
        }
      }

      return { created, updated, skipped };
    },
  });
};
