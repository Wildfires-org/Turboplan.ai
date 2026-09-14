import { and, count, desc, eq, isNull, sql } from "drizzle-orm";

import { profile, timelineRecord, user } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

import type { TimelineQueryParams } from "../schemas";
import type { EnrichedTimelineRecord } from "../types";

export const getTimeline = async (
  projectId: string,
  params: TimelineQueryParams,
) => {
  const { page, limit, entityType, action, userId, isPublic } = params;
  const offset = (page - 1) * limit;

  const conditions = [
    eq(timelineRecord.projectId, projectId),
    isNull(timelineRecord.deletedAt),
  ];

  if (entityType) {
    conditions.push(eq(timelineRecord.entityType, entityType));
  }
  if (action) {
    conditions.push(eq(timelineRecord.action, action));
  }
  if (userId) {
    conditions.push(eq(timelineRecord.userId, userId));
  }
  if (isPublic !== undefined) {
    conditions.push(eq(timelineRecord.isPublic, isPublic));
  }

  const where = and(...conditions);

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: timelineRecord.id,
        projectId: timelineRecord.projectId,
        userId: timelineRecord.userId,
        entityType: timelineRecord.entityType,
        entityId: timelineRecord.entityId,
        entityName: timelineRecord.entityName,
        action: timelineRecord.action,
        title: timelineRecord.title,
        description: timelineRecord.description,
        changes: timelineRecord.changes,
        resourceUrls: timelineRecord.resourceUrls,
        isPublic: timelineRecord.isPublic,
        metadata: timelineRecord.metadata,
        startedAt: timelineRecord.startedAt,
        endedAt: timelineRecord.endedAt,
        createdAt: timelineRecord.createdAt,
        deletedAt: timelineRecord.deletedAt,
        authorEmail: user.email,
        authorFirstName: profile.firstName,
        authorLastName: profile.lastName,
        authorAvatarUrl: profile.avatarUrl,
      })
      .from(timelineRecord)
      .innerJoin(user, eq(timelineRecord.userId, user.id))
      .leftJoin(profile, eq(user.id, profile.userId))
      .where(where)
      .orderBy(
        sql`${timelineRecord.startedAt} DESC NULLS LAST`,
        desc(timelineRecord.createdAt),
      )
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(timelineRecord).where(where),
  ]);

  const total = totalResult[0]?.count ?? 0;

  return {
    // Safe cast: select shape matches EnrichedTimelineRecord fields exactly
    // (innerJoin user guarantees authorEmail; leftJoin profile allows null author fields)
    records: rows as EnrichedTimelineRecord[],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getTimelineStats = async (projectId: string) => {
  const results = await db
    .select({
      entityType: timelineRecord.entityType,
      action: timelineRecord.action,
      count: count(),
    })
    .from(timelineRecord)
    .where(
      and(
        eq(timelineRecord.projectId, projectId),
        isNull(timelineRecord.deletedAt),
      ),
    )
    .groupBy(timelineRecord.entityType, timelineRecord.action);

  let total = 0;
  const byEntityType = results.reduce(
    (acc, row) => {
      total += row.count;
      if (!acc[row.entityType]) {
        acc[row.entityType] = {};
      }
      acc[row.entityType][row.action] = row.count;
      return acc;
    },
    {} as Record<string, Record<string, number>>,
  );

  return { total, byEntityType };
};

export const toggleRecordVisibility = async (
  recordId: string,
  projectId: string,
) => {
  const [updated] = await db
    .update(timelineRecord)
    .set({ isPublic: sql`NOT ${timelineRecord.isPublic}` })
    .where(
      and(
        eq(timelineRecord.id, recordId),
        eq(timelineRecord.projectId, projectId),
        isNull(timelineRecord.deletedAt),
      ),
    )
    .returning({ id: timelineRecord.id, isPublic: timelineRecord.isPublic });

  return updated ?? null;
};

export const softDeleteRecord = async (recordId: string, projectId: string) => {
  const [updated] = await db
    .update(timelineRecord)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(timelineRecord.id, recordId),
        eq(timelineRecord.projectId, projectId),
        isNull(timelineRecord.deletedAt),
      ),
    )
    .returning({ id: timelineRecord.id });

  return updated ?? null;
};
