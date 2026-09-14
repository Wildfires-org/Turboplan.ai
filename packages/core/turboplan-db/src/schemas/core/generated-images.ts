import type { InferSelectModel } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "./user";

// Define enum for entity types
export const entityTypeEnum = pgEnum("entity_type", [
  "project",
  "office",
  "organization",
]);

export const generatedImages = pgTable("generated_images", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  entityId: uuid("entity_id").notNull(),
  entityType: entityTypeEnum("entity_type").notNull(),
  imageUrl: text("image_url").notNull(),
  prompt: text("prompt").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => user.id),
});

export type GeneratedImage = InferSelectModel<typeof generatedImages>;
