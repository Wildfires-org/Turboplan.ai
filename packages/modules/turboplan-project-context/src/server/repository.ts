import { eq, sql } from "drizzle-orm";

import { projectContext } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

export type InsertProjectContextItem = {
  label: string;
  content: string;
  url?: string;
};

export type UpsertProjectContextResult = {
  created: Array<{ id: string; label: string }>;
  updated: Array<{ id: string; label: string }>;
};

export async function getProjectContextByProjectId(projectId: string) {
  return db
    .select({
      id: projectContext.id,
      label: projectContext.label,
      content: projectContext.content,
      url: projectContext.url,
    })
    .from(projectContext)
    .where(eq(projectContext.projectId, projectId))
    .orderBy(projectContext.createdAt);
}

/**
 * Bulk-insert context entries. Returns the inserted rows' ids and labels so
 * callers can reference the created entries (e.g. for timeline records).
 */
export async function insertProjectContext(
  projectId: string,
  items: InsertProjectContextItem[],
  userId?: string,
): Promise<Array<{ id: string; label: string }>> {
  if (items.length === 0) {
    return [];
  }

  return db
    .insert(projectContext)
    .values(
      items.map((item) => ({
        projectId,
        label: item.label.slice(0, 200),
        content: item.content,
        url: item.url ?? null,
        createdBy: userId ?? null,
      })),
    )
    .returning({ id: projectContext.id, label: projectContext.label });
}

/**
 * Upsert context entries by case-insensitive label: matching labels get their
 * content (and url, when provided) updated; the rest are bulk-inserted.
 *
 * Runs in a transaction holding a per-project advisory lock — there is no
 * unique constraint on (projectId, label), so without the lock two concurrent
 * calls could both miss an existing label and insert duplicate rows.
 *
 * An item that omits `url` keeps the stored url untouched; content-only
 * updates must not clear an existing source citation.
 */
export async function upsertProjectContextEntries(
  projectId: string,
  items: InsertProjectContextItem[],
  userId?: string,
): Promise<UpsertProjectContextResult> {
  if (items.length === 0) {
    return { created: [], updated: [] };
  }

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`project-context:${projectId}`}, 0))`,
    );

    const existing = await tx
      .select({ id: projectContext.id, label: projectContext.label })
      .from(projectContext)
      .where(eq(projectContext.projectId, projectId));

    const existingByLabel = new Map(
      existing.map((entry) => [entry.label.trim().toLowerCase(), entry]),
    );

    const updated: Array<{ id: string; label: string }> = [];
    const toInsert: InsertProjectContextItem[] = [];

    for (const item of items) {
      const match = existingByLabel.get(item.label.trim().toLowerCase());
      if (!match) {
        toInsert.push(item);
        continue;
      }

      const [row] = await tx
        .update(projectContext)
        .set({
          content: item.content,
          ...(item.url !== undefined ? { url: item.url } : {}),
          updatedAt: new Date(),
        })
        .where(eq(projectContext.id, match.id))
        .returning({ id: projectContext.id, label: projectContext.label });
      if (row) {
        updated.push(row);
      }
    }

    let created: Array<{ id: string; label: string }> = [];
    if (toInsert.length > 0) {
      created = await tx
        .insert(projectContext)
        .values(
          toInsert.map((item) => ({
            projectId,
            label: item.label.slice(0, 200),
            content: item.content,
            url: item.url ?? null,
            createdBy: userId ?? null,
          })),
        )
        .returning({ id: projectContext.id, label: projectContext.label });
    }

    return { created, updated };
  });
}
