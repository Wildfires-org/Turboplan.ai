import type { EnrichedTimelineRecord } from "../types";

export type TimelineDisplayEntry = {
  id: string;
  entityId: string;
  dateRange: string;
  authorName: string;
  authorInitials: string | null;
  authorAvatarUrl: string | null;
  title: string;
  description: string;
  documents: { filename: string; url: string }[];
  isPublic: boolean;
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  project: "Project",
  task: "Task",
  milestone: "Milestone",
  map_layer: "Map Layer",
  field: "Field",
  comment: "Comment",
  document: "Document",
  member: "Member",
  dependency: "Dependency",
};

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  added: "Added",
  removed: "Removed",
  role_changed: "Role changed for",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  title: "Title",
  description: "Description",
  status: "Status",
  isPublic: "Visibility",
  startDate: "Start date",
  endDate: "End date",
  dueDate: "Due date",
  assigneeIds: "Assignees",
  milestoneId: "Milestone",
  order: "Order",
  content: "Content",
  originalFilename: "Filename",
  mimeType: "File type",
  size: "File size",
  role: "Role",
  layerName: "Layer name",
  layerType: "Layer type",
  isRequired: "Required",
  tooltip: "Tooltip",
  values: "Values",
  coverImageId: "Cover image",
  hiddenModules: "Hidden modules",
  privateModules: "Private modules",
  moduleOrder: "Module order",
  dependencies: "Dependencies",
  projectDocumentIds: "Documents",
};

const formatDate = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatMonth = (date: Date | string): string => {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const formatDateRange = (
  startedAt: Date | string | null,
  endedAt: Date | string | null,
  createdAt: Date | string,
): string => {
  if (startedAt && endedAt) {
    return `${formatMonth(startedAt)} \u2013 ${formatMonth(endedAt)}`;
  }
  if (startedAt) {
    return formatDate(startedAt);
  }
  return formatDate(createdAt);
};

const getAuthorName = (record: EnrichedTimelineRecord): string => {
  if (record.authorFirstName || record.authorLastName) {
    return [record.authorFirstName, record.authorLastName]
      .filter(Boolean)
      .join(" ");
  }
  return record.authorEmail ?? "Unknown user";
};

const getAuthorInitials = (record: EnrichedTimelineRecord): string | null => {
  if (record.authorFirstName && record.authorLastName) {
    return `${record.authorFirstName[0]}${record.authorLastName[0]}`.toUpperCase();
  }
  if (record.authorFirstName) {
    return record.authorFirstName[0].toUpperCase();
  }
  return null;
};

const generateTitle = (record: EnrichedTimelineRecord): string => {
  const action = ACTION_LABELS[record.action] ?? record.action;
  const entityType = ENTITY_TYPE_LABELS[record.entityType] ?? record.entityType;

  if (record.entityName) {
    return `${action} ${entityType} "${record.entityName}"`;
  }
  return `${action} ${entityType}`;
};

const QUOTED_VALUE_TYPES = new Set(["string", "text"]);

/** Converts snake_case enum values like "not_started" to "Not Started" */
const humanizeEnum = (value: string): string =>
  value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

const formatChangeValue = (
  value: unknown,
  valueType: string,
): { text: string; quoted: boolean } => {
  if (value === null || value === undefined) {
    return { text: "empty", quoted: false };
  }

  switch (valueType) {
    case "boolean":
      return { text: value ? "enabled" : "disabled", quoted: false };
    case "date": {
      try {
        return { text: formatDate(value as string), quoted: false };
      } catch {
        return { text: String(value), quoted: false };
      }
    }
    case "json":
      return { text: "updated", quoted: false };
    case "users":
    case "user":
      if (Array.isArray(value)) {
        return {
          text: `${value.length} user${value.length === 1 ? "" : "s"}`,
          quoted: false,
        };
      }
      return { text: String(value), quoted: false };
    case "enum":
    case "role":
      return { text: humanizeEnum(String(value)), quoted: false };
    default: {
      const str = String(value);
      const shouldQuote = QUOTED_VALUE_TYPES.has(valueType) || !valueType;
      return { text: str, quoted: shouldQuote };
    }
  }
};

const wrapValue = (val: { text: string; quoted: boolean }): string =>
  val.quoted ? `"${val.text}"` : val.text;

const generateDescription = (record: EnrichedTimelineRecord): string => {
  if (!record.changes || record.changes.length === 0) {
    return "";
  }

  return record.changes
    .map((change) => {
      const fieldLabel = FIELD_LABELS[change.field] ?? change.field;
      const oldVal = formatChangeValue(change.previousValue, change.valueType);
      const newVal = formatChangeValue(change.newValue, change.valueType);

      if (change.valueType === "json") {
        // For array fields like projectDocumentIds, show added/removed counts
        if (
          change.field === "projectDocumentIds" &&
          (Array.isArray(change.previousValue) ||
            Array.isArray(change.newValue))
        ) {
          const prev = Array.isArray(change.previousValue)
            ? (change.previousValue as string[])
            : [];
          const next = Array.isArray(change.newValue)
            ? (change.newValue as string[])
            : [];
          const added = next.filter((id) => !prev.includes(id)).length;
          const removed = prev.filter((id) => !next.includes(id)).length;
          const parts: string[] = [];
          if (added > 0) {
            parts.push(`${added} document${added > 1 ? "s" : ""} linked`);
          }
          if (removed > 0) {
            parts.push(`${removed} document${removed > 1 ? "s" : ""} unlinked`);
          }
          if (parts.length > 0) {
            return parts.join(", ");
          }
        }
        return `${fieldLabel} updated`;
      }

      if (change.previousValue === null || change.previousValue === undefined) {
        return `${fieldLabel} set to ${wrapValue(newVal)}`;
      }

      return `${fieldLabel} changed from ${wrapValue(oldVal)} to ${wrapValue(newVal)}`;
    })
    .join("\n");
};

export const transformTimelineRecord = (
  record: EnrichedTimelineRecord,
): TimelineDisplayEntry => {
  return {
    id: record.id,
    entityId: record.entityId,
    dateRange: formatDateRange(
      record.startedAt,
      record.endedAt,
      record.createdAt,
    ),
    authorName: getAuthorName(record),
    authorInitials: getAuthorInitials(record),
    authorAvatarUrl: record.authorAvatarUrl,
    title: record.title ?? generateTitle(record),
    description: record.description ?? generateDescription(record),
    documents: (record.resourceUrls ?? []).map((r) => ({
      filename: r.filename,
      url: r.url,
    })),
    isPublic: record.isPublic,
  };
};
