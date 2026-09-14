import { and, eq, max, sql } from "drizzle-orm";

import { projectField } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  computeChanges,
  createTimelineRecord,
  projectCustomFieldDefs,
} from "@wildfires-org/turboplan-timeline-records/server";

import { MAX_FIELDS_PER_PROJECT, type ProjectFieldType } from "../schemas";

type ProjectFieldRow = typeof projectField.$inferSelect;

export type CreateProjectFieldEntryInput = {
  projectId: string;
  name: string;
  type: ProjectFieldType;
  values: string[];
  userId: string;
};

/**
 * Create a new project field with transactional order assignment and a timeline
 * record. Returns null (without inserting) when the project has already reached
 * MAX_FIELDS_PER_PROJECT.
 */
export const createProjectFieldEntry = async ({
  projectId,
  name,
  type,
  values,
  userId,
}: CreateProjectFieldEntryInput): Promise<ProjectFieldRow | null> => {
  // The field-count cap and the next order value are both read-then-write, so
  // concurrent creates must be serialized: a transaction alone (read
  // committed) would let two calls read the same count/order and both insert.
  // The per-project advisory lock is released automatically at commit.
  const newField = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`project-fields:${projectId}`}, 0))`,
    );

    const countResult = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(projectField)
      .where(eq(projectField.projectId, projectId));

    if ((countResult[0]?.count ?? 0) >= MAX_FIELDS_PER_PROJECT) {
      return null;
    }

    const maxOrderResult = await tx
      .select({ maxOrder: max(projectField.order) })
      .from(projectField)
      .where(eq(projectField.projectId, projectId));

    const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

    const [inserted] = await tx
      .insert(projectField)
      .values({
        projectId,
        name,
        type,
        order: nextOrder,
        values,
      })
      .returning();

    return inserted;
  });

  if (!newField) {
    return null;
  }

  await createTimelineRecord({
    projectId,
    userId,
    entityType: "field",
    entityId: newField.id,
    entityName: newField.name,
    action: "created",
  });

  return newField;
};

export type UpdateProjectFieldValuesInput = {
  projectId: string;
  fieldId: string;
  values: string[];
  userId: string;
};

/**
 * Update an existing field's values. Verifies the field belongs to the given
 * project first; returns null when it does not (caller should treat this as
 * "not found" without revealing whether the field exists elsewhere). Records a
 * timeline entry when the values actually change.
 */
export const updateProjectFieldValues = async ({
  projectId,
  fieldId,
  values,
  userId,
}: UpdateProjectFieldValuesInput): Promise<ProjectFieldRow | null> => {
  const existing = await db
    .select()
    .from(projectField)
    .where(
      and(eq(projectField.id, fieldId), eq(projectField.projectId, projectId)),
    )
    .limit(1);

  if (existing.length === 0) {
    return null;
  }

  const oldField = existing[0];

  const [updatedField] = await db
    .update(projectField)
    .set({ values, updatedAt: new Date() })
    .where(eq(projectField.id, fieldId))
    .returning();

  // Field deleted between the existence check and the update.
  if (!updatedField) {
    return null;
  }

  const changes = computeChanges(
    oldField,
    updatedField,
    projectCustomFieldDefs,
  );
  if (changes.length > 0) {
    await createTimelineRecord({
      projectId,
      userId,
      entityType: "field",
      entityId: fieldId,
      entityName: updatedField.name,
      action: "updated",
      changes,
    });
  }

  return updatedField;
};
