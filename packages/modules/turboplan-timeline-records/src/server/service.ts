import {
  and,
  count,
  desc,
  eq,
  isNull,
  notInArray,
  type SQL,
  sql,
} from "drizzle-orm";

import {
  profile,
  project,
  timelineRecord,
  user,
} from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

import type { TimelineQueryParams } from "../schemas";
import type { EnrichedTimelineRecord } from "../types";
import {
  getPubliclyHiddenEntityTypes,
  toPublicTimelineRecord,
} from "./public-view";

export type TimelineViewOptions = {
  /**
   * The caller holds no role on the project (e.g. a citizen reading a public
   * government project). Restricts the view to what the public timeline shows:
   * public records only, none from hidden/private modules, no author email.
   */
  publicView?: boolean;
};

/**
 * Base WHERE conditions for a project's timeline. The public view additionally
 * keeps only public records and drops entity types of hidden/private modules.
 */
const getBaseConditions = async (
  projectId: string,
  { publicView = false }: TimelineViewOptions,
): Promise<SQL[]> => {
  const conditions = [
    eq(timelineRecord.projectId, projectId),
    isNull(timelineRecord.deletedAt),
  ];

  if (!publicView) {
    return conditions;
  }

  conditions.push(eq(timelineRecord.isPublic, true));

  const [modules] = await db
    .select({
      hiddenModules: project.hiddenModules,
      privateModules: project.privateModules,
    })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);

  const hiddenEntityTypes = getPubliclyHiddenEntityTypes(
    modules?.hiddenModules,
    modules?.privateModules,
  );
  if (hiddenEntityTypes.length > 0) {
    conditions.push(notInArray(timelineRecord.entityType, hiddenEntityTypes));
  }

  return conditions;
};

export const getTimeline = async (
  projectId: string,
  params: TimelineQueryParams,
  options: TimelineViewOptions = {},
) => {
  const { page, limit, entityType, action, userId, isPublic } = params;
  const offset = (page - 1) * limit;

  const conditions = await getBaseConditions(projectId, options);

  if (entityType) {
    conditions.push(eq(timelineRecord.entityType, entityType));
  }
  if (action) {
    conditions.push(eq(timelineRecord.action, action));
  }
  // The public view hides record authorship ids, so it does not filter by them.
  if (userId && !options.publicView) {
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
  // Safe cast: select shape matches EnrichedTimelineRecord fields exactly
  // (innerJoin user guarantees authorEmail; leftJoin profile allows null author fields)
  const records = rows as EnrichedTimelineRecord[];

  return {
    records: options.publicView ? records.map(toPublicTimelineRecord) : records,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getTimelineStats = async (
  projectId: string,
  options: TimelineViewOptions = {},
) => {
  const conditions = await getBaseConditions(projectId, options);
  const results = await db
    .select({
      entityType: timelineRecord.entityType,
      action: timelineRecord.action,
      count: count(),
    })
    .from(timelineRecord)
    .where(and(...conditions))
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
