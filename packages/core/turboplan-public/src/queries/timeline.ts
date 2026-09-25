import { and, desc, eq, isNull, notInArray } from "drizzle-orm";

import { profile, timelineRecord, user } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";
import {
  getPubliclyHiddenEntityTypes,
  toPublicTimelineRecord,
} from "@wildfires-org/turboplan-timeline-records/server";

type ProjectModuleVisibility = {
  hiddenModules: readonly string[] | null;
  privateModules: readonly string[] | null;
};

/**
 * Fetch public, non-deleted timeline records for a project, excluding records
 * of modules the project hides or keeps private.
 * Joins with user/profile for the author's display name (never their email).
 * Returns at most 50 records ordered by creation date descending.
 */
export const getPublicTimelineRecords = async (
  projectId: string,
  { hiddenModules, privateModules }: ProjectModuleVisibility,
) => {
  const hiddenEntityTypes = getPubliclyHiddenEntityTypes(
    hiddenModules,
    privateModules,
  );

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
        hiddenEntityTypes.length > 0
          ? notInArray(timelineRecord.entityType, hiddenEntityTypes)
          : undefined,
      ),
    )
    .orderBy(desc(timelineRecord.createdAt))
    .limit(50);

  return rows.map(toPublicTimelineRecord);
};
