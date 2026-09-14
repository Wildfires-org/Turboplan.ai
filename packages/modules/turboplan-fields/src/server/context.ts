import { eq } from "drizzle-orm";

import { projectField } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

/**
 * Load project fields and format them as a system prompt context block.
 * Listed values are authoritative; fields with no value are marked [EMPTY]
 * so the model treats them as known gaps rather than inventing values.
 * Returns undefined if no fields exist for this project.
 */
export const getProjectFieldsForChat = async (
  projectId: string,
): Promise<string | undefined> => {
  const fields = await db
    .select()
    .from(projectField)
    .where(eq(projectField.projectId, projectId))
    .orderBy(projectField.order);

  if (fields.length === 0) {
    return undefined;
  }

  const lines = fields
    .map((field) => {
      let line = `- **${field.name}** (ID: ${field.id})`;
      if (field.isRequired) {
        line += " (required)";
      }
      const filledValues = field.values.filter((v) => v.trim().length > 0);
      if (filledValues.length === 0) {
        line += ": [EMPTY]";
      } else {
        line += `: ${filledValues.join(", ")}`;
      }
      if (field.tooltip) {
        line += ` — ${field.tooltip}`;
      }
      return line;
    })
    .join("\n");

  return `# PROJECT FIELDS\nStructured fields the team defined for this project. Listed values are authoritative — use them exactly. Fields marked [EMPTY] have no value yet: treat them as known gaps — never invent their values. To fill or correct a field once you have learned its value, call the updateProjectFields tool with the field's ID.\n\n${lines}`;
};
