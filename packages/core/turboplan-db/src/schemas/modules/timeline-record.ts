import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  index,
  json,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "../core/user";
import { project } from "../workspace/project";

export const timelineRecord = pgTable(
  "timeline_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    entityName: text("entity_name"),
    action: text("action").notNull(),
    title: text("title"),
    description: text("description"),
    changes:
      json("changes").$type<
        {
          field: string;
          previousValue: unknown;
          newValue: unknown;
          valueType: string;
        }[]
      >(),
    resourceUrls:
      json("resource_urls").$type<
        { url: string; filename: string; type?: string }[]
      >(),
    isPublic: boolean("is_public").notNull().default(false),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("idx_timeline_record_project_id").on(table.projectId),
    index("idx_timeline_record_created_at").on(table.createdAt),
    index("idx_timeline_record_entity").on(table.entityType, table.entityId),
    index("idx_timeline_record_project_created").on(
      table.projectId,
      table.createdAt,
    ),
    index("idx_timeline_record_stats").on(
      table.projectId,
      table.entityType,
      table.action,
    ),
  ],
);

export type TimelineRecord = InferSelectModel<typeof timelineRecord>;
