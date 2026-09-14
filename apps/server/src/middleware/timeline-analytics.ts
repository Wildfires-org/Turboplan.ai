import type { CreateTimelineRecordInput } from "@wildfires-org/turboplan-timeline-records/types";

import { captureEvent } from "./posthog.js";
import { toAnalyticsEvent } from "./timeline-analytics-mapping.js";

/**
 * Post-write analytics hook for the timeline recorder — the single place
 * server-side business events are derived from mutations. Wired via
 * `configureRecorderAnalytics()` in the router bootstrap.
 */
export const captureTimelineAnalytics = (input: CreateTimelineRecordInput) => {
  const event = toAnalyticsEvent(input);
  if (!event) {
    return;
  }

  const source = input.metadata?.source;

  captureEvent(input.userId, event, {
    project_id: input.projectId,
    entity_id: input.entityId,
    source: source === "mcp" || source === "system" ? source : "web",
  });
};
