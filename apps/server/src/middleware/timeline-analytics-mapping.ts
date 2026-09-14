import { TaskStatus } from "@wildfires-org/turboplan-db";
import type { CreateTimelineRecordInput } from "@wildfires-org/turboplan-timeline-records/types";

import type { AnalyticsEvent } from "./analytics-events.js";
import { ANALYTICS_EVENTS } from "./analytics-events.js";

// Tied to the DB enum so a status rename is a compile-time signal here,
// not a silently dead mapping.
const COMPLETED_STATUS_VALUES: string[] = [TaskStatus.COMPLETED];

/**
 * Maps a timeline record to a product analytics event, or null for record
 * types outside the tracking plan (comments, fields, map layers, ...).
 * Organization/office events are not derivable here — the timeline is
 * project-scoped; those are captured in the workspace routers instead.
 */
export const toAnalyticsEvent = (
  input: CreateTimelineRecordInput,
): AnalyticsEvent | null => {
  const { entityType, action } = input;

  if (entityType === "project" && action === "created") {
    return ANALYTICS_EVENTS.PROJECT_CREATED;
  }

  if (entityType === "task") {
    if (action === "created") {
      return ANALYTICS_EVENTS.TASK_CREATED;
    }
    if (action === "updated") {
      const statusChange = input.changes?.find((c) => c.field === "status");
      if (
        statusChange &&
        COMPLETED_STATUS_VALUES.includes(
          String(statusChange.newValue).toLowerCase(),
        )
      ) {
        return ANALYTICS_EVENTS.TASK_COMPLETED;
      }
      const milestoneChange = input.changes?.find(
        (c) => c.field === "milestone" || c.field === "milestoneId",
      );
      if (milestoneChange) {
        return ANALYTICS_EVENTS.TASK_MOVED;
      }
    }
    return null;
  }

  if (entityType === "milestone") {
    if (action === "created") {
      return ANALYTICS_EVENTS.MILESTONE_CREATED;
    }
    if (action === "updated") {
      const statusChange = input.changes?.find((c) => c.field === "status");
      if (
        statusChange &&
        COMPLETED_STATUS_VALUES.includes(
          String(statusChange.newValue).toLowerCase(),
        )
      ) {
        return ANALYTICS_EVENTS.MILESTONE_COMPLETED;
      }
    }
    return null;
  }

  if (entityType === "document") {
    if (action === "created" || action === "added") {
      return ANALYTICS_EVENTS.DOCUMENT_UPLOADED;
    }
    if (action === "deleted" || action === "removed") {
      return ANALYTICS_EVENTS.DOCUMENT_DELETED;
    }
    return null;
  }

  if (entityType === "member") {
    if (action === "added") {
      return ANALYTICS_EVENTS.MEMBER_JOINED;
    }
    if (action === "role_changed") {
      return ANALYTICS_EVENTS.MEMBER_ROLE_CHANGED;
    }
    return null;
  }

  return null;
};
