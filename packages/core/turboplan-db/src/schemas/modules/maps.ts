/**
 * Using Drizzle ORM for type-safe database access
 */
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { project } from "../workspace/project";

// Layer type enum
export const layerTypeEnum = pgEnum("layer_type_enum", [
  "project_boundary",
  "units_boundary",
]);

export const layers = pgTable(
  "map_layers",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // FK to the owning project, cascading on delete so layers (and their
    // cascaded features) don't outlive the project. Indexed so tenant filtering
    // isn't a full scan.
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 255 }).notNull(),
    layerName: varchar("layer_name", { length: 255 }).notNull(),
    sourceFilename: varchar("source_filename", { length: 255 }).notNull(),
    fileType: varchar("file_type", { length: 20 }).notNull(),
    layerType: layerTypeEnum("layer_type")
      .notNull()
      .default("project_boundary"),

    // Feature count
    featureCount: integer("feature_count").notNull().default(0),

    // Properties metadata
    propertiesList: jsonb("properties_list").$type<string[]>(),

    // Unit detection metadata (for units_boundary layers)
    unitIdKey: varchar("unit_id_key", { length: 100 }),
    unitAcresKey: varchar("unit_acres_key", { length: 100 }),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    projectIdIdx: index("map_layers_project_id_idx").on(table.projectId),
  }),
);

export const features = pgTable(
  "map_features",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    layerId: uuid("layer_id")
      .notNull()
      .references(() => layers.id, { onDelete: "cascade" }),

    geometry: customType<{ data: unknown; driverData: string }>({
      dataType() {
        return "geometry";
      },
      fromDriver(value: string): unknown {
        return value;
      },
    })("geometry"),

    featureName: varchar("feature_name", { length: 255 }),
    featureType: varchar("feature_type", { length: 100 }),
    properties: jsonb("properties"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    // Spatial index for geometry
    featuresGeometrySpatialIdx: index("features_geometry_spatial_idx").using(
      "gist",
      table.geometry,
    ),
  }),
);

export type Layer = InferSelectModel<typeof layers>;
export type NewLayer = InferInsertModel<typeof layers>;
export type Feature = InferSelectModel<typeof features>;
export type NewFeature = InferInsertModel<typeof features>;
