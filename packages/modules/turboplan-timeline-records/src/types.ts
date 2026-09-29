import type { TimelineRecord } from "@wildfires-org/turboplan-db";
export type { TimelineRecord };

export const ENTITY_TYPES = [
  "project",
  "task",
  "milestone",
  "map_layer",
  "field",
  "comment",
  "context",
  "document",
  "member",
  "dependency",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const ACTIONS = [
  "created",
  "updated",
  "deleted",
  "added",
  "removed",
  "role_changed",
] as const;

export type Action = (typeof ACTIONS)[number];

export const VALUE_TYPES = [
  "text",
  "number",
  "date",
  "boolean",
  "user",
  "users",
  "enum",
  "json",
  "role",
] as const;

export type ValueType = (typeof VALUE_TYPES)[number];

export type FieldChange = {
  field: string;
  previousValue?: unknown;
  newValue?: unknown;
  valueType: ValueType;
};

export type FieldDefinition = {
  field: string;
  valueType: ValueType;
};

export type ResourceUrl = {
  url: string;
  filename: string;
  type?: string;
};

export type CreateTimelineRecordInput = {
  projectId: string;
  userId: string;
  entityType: EntityType;
  entityId: string;
  entityName?: string;
  action: Action;
  title?: string;
  description?: string;
  changes?: FieldChange[];
  resourceUrls?: ResourceUrl[];
  isPublic?: boolean;
  startedAt?: Date | string;
  endedAt?: Date | string;
  metadata?: Record<string, unknown>;
};

export type EnrichedTimelineRecord = TimelineRecord & {
  /** Null in the view served to callers without a role on the project. */
  authorEmail: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  authorAvatarUrl: string | null;
};
