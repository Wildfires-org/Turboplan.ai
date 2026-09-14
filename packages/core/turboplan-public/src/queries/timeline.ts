import { and, desc, eq, isNull } from "drizzle-orm";

import { profile, timelineRecord, user } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

/**
 * Fetch public, non-deleted timeline records for a project.
 * Joins with user/profile for author information.
 * Returns at most 50 records ordered by creation date descending.
 */
export const getPublicTimelineRecords = async (projectId: string) => {
  const rows = await db
    .select({
      id: timelineRecord.id,
      projectId: timelineRecord.projectId,
      entityType: timelineRecord.entityType,
      entityId: timelineRecord.entityId,
      entityName: timelineRecord.entityName,
      action: timelineRecord.action,
      title: timelineRecord.title,
      description: timelineRecord.description,
      changes: timelineRecord.changes,
      resourceUrls: timelineRecord.resourceUrls,
      isPublic: timelineRecord.isPublic,
      startedAt: timelineRecord.startedAt,
      endedAt: timelineRecord.endedAt,
      createdAt: timelineRecord.createdAt,
      authorEmail: user.email,
      authorFirstName: profile.firstName,
      authorLastName: profile.lastName,
      authorAvatarUrl: profile.avatarUrl,
    })
    .from(timelineRecord)
    .innerJoin(user, eq(timelineRecord.userId, user.id))
    .leftJoin(profile, eq(user.id, profile.userId))
    .where(
      and(
        eq(timelineRecord.projectId, projectId),
        isNull(timelineRecord.deletedAt),
        eq(timelineRecord.isPublic, true),
      ),
    )
    .orderBy(desc(timelineRecord.createdAt))
    .limit(50);

  return rows;
};
