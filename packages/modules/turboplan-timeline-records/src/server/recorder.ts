import { timelineRecord } from "@wildfires-org/turboplan-db";
import { db } from "@wildfires-org/turboplan-db/db-client";

import type { CreateTimelineRecordInput } from "../types";

let errorHandler: ((error: Error) => void) | undefined;
let analyticsHandler: ((input: CreateTimelineRecordInput) => void) | undefined;

/**
 * Configure the global error handler for timeline recording failures.
 * Call once at server startup to wire up PostHog or any error reporter.
 */
export const configureRecorder = (onError: (error: Error) => void) => {
  errorHandler = onError;
};

/**
 * Configure a post-write analytics hook, invoked once per successfully
 * written record. The recorder is the single choke point every mutation
 * flows through (web, MCP, system), so one hook here gives product
 * analytics full server-side coverage. Handler failures are swallowed —
 * analytics can never break a business operation.
 */
export const configureRecorderAnalytics = (
  onRecord: (input: CreateTimelineRecordInput) => void,
) => {
  analyticsHandler = onRecord;
};

const emitAnalytics = (input: CreateTimelineRecordInput) => {
  try {
    analyticsHandler?.(input);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    errorHandler?.(err);
  }
};

// Shared row mapper so both recorder functions write identical rows.
const toTimelineRow = (input: CreateTimelineRecordInput) => ({
  projectId: input.projectId,
  userId: input.userId,
  entityType: input.entityType,
  entityId: input.entityId,
  entityName: input.entityName,
  action: input.action,
  title: input.title ?? null,
  description: input.description ?? null,
  changes:
    input.changes?.map((c) => ({
      field: c.field,
      previousValue: c.previousValue ?? null,
      newValue: c.newValue ?? null,
      valueType: c.valueType,
    })) ?? null,
  resourceUrls: input.resourceUrls ?? null,
  isPublic: input.isPublic ?? false,
  startedAt: input.startedAt ? new Date(input.startedAt) : null,
  endedAt: input.endedAt ? new Date(input.endedAt) : null,
  metadata: input.metadata ?? null,
});

/**
 * Records a change in the timeline. Failures are caught internally and
 * forwarded to the configured error handler — timeline recording
 * never blocks or breaks business operations.
 */
export const createTimelineRecord = async (
  input: CreateTimelineRecordInput,
): Promise<void> => {
  try {
    await db.insert(timelineRecord).values(toTimelineRow(input));
    emitAnalytics(input);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    errorHandler?.(err);
  }
};

/**
 * Inserts a timeline record and propagates DB errors to the caller.
 * Use for user-initiated save flows where the caller needs to know
 * which inserts actually succeeded.
 */
export const createTimelineRecordOrThrow = async (
  input: CreateTimelineRecordInput,
): Promise<void> => {
  await db.insert(timelineRecord).values(toTimelineRow(input));
  emitAnalytics(input);
};
