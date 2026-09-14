"use client";

import { useMemo } from "react";

import {
  ReadOnlyTimelineContent,
  transformTimelineRecord,
} from "@wildfires-org/turboplan-timeline-records/client";
import type { EnrichedTimelineRecord } from "@wildfires-org/turboplan-timeline-records/types";

interface PublicTimelineSectionProps {
  records: EnrichedTimelineRecord[];
}

export function PublicTimelineSection({ records }: PublicTimelineSectionProps) {
  const entries = useMemo(
    () => records.map(transformTimelineRecord),
    [records],
  );

  return (
    <ReadOnlyTimelineContent entries={entries} isLoading={false} error={null} />
  );
}
