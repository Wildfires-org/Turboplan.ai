import type { InferSelectModel } from "drizzle-orm";
import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { user } from "./user";

export const aiModelConfig = pgTable("ai_model_config", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  primaryModel: varchar("primary_model", { length: 255 }),
  liteModel: varchar("lite_model", { length: 255 }),
  imagePrimaryModel: varchar("image_primary_model", { length: 255 }),
  imageLiteModel: varchar("image_lite_model", { length: 255 }),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => user.id),
});

export type AiModelConfig = InferSelectModel<typeof aiModelConfig>;
