/**
 * Public Image Queries
 *
 * Database queries for fetching image data without authentication.
 */

import { and, eq, isNull } from "drizzle-orm";

import { project } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

/**
 * Check if an image belongs to a public project.
 * Returns the project ID if found, null otherwise.
 */
export async function getPublicProjectByImageId(imageId: string) {
  const result = await db
    .select({ id: project.id })
    .from(project)
    .where(
      and(
        eq(project.coverImageId, imageId),
        eq(project.isPublic, true),
        eq(project.status, "active"),
        eq(project.isTemplate, false),
        isNull(project.deletedAt),
      ),
    )
    .limit(1);

  return result.length > 0 ? result[0] : null;
}
