import type { InferSelectModel } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "../core/user";
import { office } from "./office";
import { organization } from "./organization";
import { project } from "./project";

export const projectSubmission = pgTable("project_submission", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => project.id),
  targetOrganizationId: uuid("target_organization_id")
    .notNull()
    .references(() => organization.id),
  targetOfficeId: uuid("target_office_id").references(() => office.id),
  // The office the project lived in at submit time, captured so a rejection
  // can revert the project to its original location.
  sourceOfficeId: uuid("source_office_id").references(() => office.id),
  submittedBy: uuid("submitted_by")
    .notNull()
    .references(() => user.id),
  reviewedBy: uuid("reviewed_by").references(() => user.id),
  reviewedAt: timestamp("reviewed_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export type ProjectSubmission = InferSelectModel<typeof projectSubmission>;
