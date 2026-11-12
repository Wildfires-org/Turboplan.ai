-- D1 (SQLite) schema migration. Generated from the pg-core schema by
-- `pnpm --filter @wildfires-org/turboplan-db d1:generate`; see
-- "Database providers" in CONFIGURATION.md.

-- Not on D1: map_features.features_geometry_spatial_idx (gist index, no SQLite equivalent).
-- Not on D1: office.office_description_trgm_idx (gin index, no SQLite equivalent).
-- Not on D1: office.office_name_trgm_idx (gin index, no SQLite equivalent).
-- Not on D1: organization.organization_description_trgm_idx (gin index, no SQLite equivalent).
-- Not on D1: organization.organization_name_trgm_idx (gin index, no SQLite equivalent).
-- Not on D1: organization.organization_short_name_trgm_idx (gin index, no SQLite equivalent).
-- Not on D1: project.project_description_trgm_idx (gin index, no SQLite equivalent).
-- Not on D1: project.project_name_trgm_idx (gin index, no SQLite equivalent).

CREATE TABLE "admin_user" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "user_id" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT,
  CONSTRAINT "admin_user_user_id_unique" UNIQUE ("user_id"),
  CONSTRAINT "admin_user_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "admin_user_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE "ai_model_config" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "primary_model" TEXT,
  "lite_model" TEXT,
  "image_primary_model" TEXT,
  "image_lite_model" TEXT,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_by" TEXT,
  CONSTRAINT "ai_model_config_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE "billing_credit_event" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT,
  "amount" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "model" TEXT,
  "cost_usd" NUMERIC,
  "overage_credits" INTEGER NOT NULL DEFAULT 0,
  "stripe_meter_reported_at" TEXT,
  "metadata" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "billing_credit_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "billing_credit_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "billing_credit_event_amount_non_negative" CHECK ("amount" >= 0),
  CONSTRAINT "billing_credit_event_overage_non_negative" CHECK ("overage_credits" >= 0)
);

CREATE INDEX "billing_credit_event_org_created_idx" ON "billing_credit_event" ("organization_id", "created_at");

CREATE TABLE "billing_credit_usage" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "organization_id" TEXT NOT NULL,
  "period_start" TEXT NOT NULL,
  "period_end" TEXT NOT NULL,
  "credits_used" INTEGER NOT NULL DEFAULT 0,
  "alert70_sent_at" TEXT,
  "alert90_sent_at" TEXT,
  "alert100_sent_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "billing_credit_usage_org_period_unique" UNIQUE ("organization_id", "period_start"),
  CONSTRAINT "billing_credit_usage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "billing_credit_usage_credits_used_non_negative" CHECK ("credits_used" >= 0)
);

CREATE TABLE "billing_webhook_event" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "type" TEXT NOT NULL,
  "processed_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "cataloger_entry" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "cataloger_run_id" TEXT NOT NULL,
  "project_id" TEXT,
  "organization_id" TEXT,
  "office_id" TEXT,
  "name" TEXT NOT NULL,
  "raw_data" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "cataloger_entry_cataloger_run_id_cataloger_run_id_fk" FOREIGN KEY ("cataloger_run_id") REFERENCES "cataloger_run" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "cataloger_entry_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "office" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "cataloger_entry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "cataloger_entry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX "cataloger_entry_run_id_idx" ON "cataloger_entry" ("cataloger_run_id");

CREATE TABLE "cataloger_run" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "user_id" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "external_run_id" TEXT,
  "webhook_secret" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'initializing',
  "current_step" TEXT,
  "entries_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "cataloger_run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX "cataloger_run_external_run_id_idx" ON "cataloger_run" ("external_run_id");

CREATE INDEX "cataloger_run_user_id_idx" ON "cataloger_run" ("user_id");

CREATE INDEX "cataloger_run_webhook_secret_idx" ON "cataloger_run" ("webhook_secret");

CREATE TABLE "chat" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT,
  "title" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "project_id" TEXT,
  "is_initial" INTEGER NOT NULL DEFAULT 0,
  "visibility" TEXT NOT NULL DEFAULT 'private',
  CONSTRAINT "chat_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "chat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "chat_one_initial_per_project_idx" ON "chat" ("project_id") WHERE is_initial = true;

CREATE INDEX "chat_project_id_idx" ON "chat" ("project_id");

CREATE INDEX "chat_project_id_updated_at_idx" ON "chat" ("project_id", "updated_at");

CREATE TABLE "comment" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "project_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "parent_comment_id" TEXT,
  "content" TEXT NOT NULL,
  "is_public" INTEGER NOT NULL DEFAULT 0,
  "is_auto_response" INTEGER NOT NULL DEFAULT 0,
  "target_user_id" TEXT,
  "auto_responder_name" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "comment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "comment_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "comment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX "comment_parent_comment_id_idx" ON "comment" ("parent_comment_id");

CREATE INDEX "comment_project_id_idx" ON "comment" ("project_id");

CREATE TABLE "document" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "created_at" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'text',
  "user_id" TEXT NOT NULL,
  "chat_id" TEXT,
  PRIMARY KEY ("id", "created_at"),
  CONSTRAINT "document_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "chat" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "document_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX "document_chat_id_idx" ON "document" ("chat_id");

CREATE TABLE "document_letterhead" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "layout" TEXT NOT NULL DEFAULT 'split',
  "lines" TEXT NOT NULL DEFAULT '',
  "contact" TEXT NOT NULL DEFAULT '',
  "logo_url" TEXT,
  "color" TEXT,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "document_letterhead_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "document_letterhead_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "document_letterhead_organization_id_idx" ON "document_letterhead" ("organization_id");

CREATE TABLE "document_letterhead_selection" (
  "document_id" TEXT PRIMARY KEY NOT NULL,
  "letterhead_id" TEXT,
  "use_own" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_by" TEXT,
  CONSTRAINT "document_letterhead_selection_letterhead_id_document_letterhead_id_fk" FOREIGN KEY ("letterhead_id") REFERENCES "document_letterhead" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "document_letterhead_selection_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "document_letterhead_selection_use_own_without_letterhead" CHECK (NOT "use_own" OR "letterhead_id" IS NULL)
);

CREATE TABLE "document_own_letterhead" (
  "document_id" TEXT PRIMARY KEY NOT NULL,
  "letterhead" TEXT NOT NULL,
  "reference_filename" TEXT NOT NULL,
  "reference_project_document_id" TEXT,
  "reference_organization_document_id" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_by" TEXT,
  CONSTRAINT "document_own_letterhead_reference_organization_document_fk" FOREIGN KEY ("reference_organization_document_id") REFERENCES "organization_document" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "document_own_letterhead_reference_project_document_fk" FOREIGN KEY ("reference_project_document_id") REFERENCES "project_document" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "document_own_letterhead_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "document_own_letterhead_single_reference" CHECK ((("reference_project_document_id" IS NOT NULL) + ("reference_organization_document_id" IS NOT NULL)) <= 1)
);

CREATE INDEX "document_own_letterhead_reference_organization_document_idx" ON "document_own_letterhead" ("reference_organization_document_id") WHERE "reference_organization_document_id" IS NOT NULL;

CREATE INDEX "document_own_letterhead_reference_project_document_idx" ON "document_own_letterhead" ("reference_project_document_id") WHERE "reference_project_document_id" IS NOT NULL;

CREATE TABLE "empty_state_suggestion" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "project_id" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "order_index" INTEGER NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "empty_state_suggestion_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "generated_images" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "entity_id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "image_url" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "created_by" TEXT NOT NULL,
  CONSTRAINT "generated_images_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE "invitations" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "token" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'viewer',
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "invited_by" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "expires_at" TEXT NOT NULL,
  "task_assignment" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "invitations_token_unique" UNIQUE ("token"),
  CONSTRAINT "invitations_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "invitations_email_idx" ON "invitations" ("email");

CREATE INDEX "invitations_entity_idx" ON "invitations" ("entity_type", "entity_id");

CREATE INDEX "invitations_invited_by_idx" ON "invitations" ("invited_by");

CREATE INDEX "invitations_status_idx" ON "invitations" ("status");

CREATE INDEX "invitations_token_idx" ON "invitations" ("token");

CREATE TABLE "map_features" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "layer_id" TEXT NOT NULL,
  "geometry" TEXT,
  "feature_name" TEXT,
  "feature_type" TEXT,
  "properties" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "map_features_layer_id_map_layers_id_fk" FOREIGN KEY ("layer_id") REFERENCES "map_layers" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "map_layers" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "project_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "layer_name" TEXT NOT NULL,
  "source_filename" TEXT NOT NULL,
  "file_type" TEXT NOT NULL,
  "layer_type" TEXT NOT NULL DEFAULT 'project_boundary',
  "feature_count" INTEGER NOT NULL DEFAULT 0,
  "properties_list" TEXT,
  "unit_id_key" TEXT,
  "unit_acres_key" TEXT,
  "created_at" TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "map_layers_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "map_layers_project_id_idx" ON "map_layers" ("project_id");

CREATE TABLE "message" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "chat_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "parts" TEXT NOT NULL,
  "attachments" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  CONSTRAINT "message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "chat" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE "milestones" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "title" TEXT NOT NULL,
  "assignee_ids" TEXT DEFAULT '{}',
  "start_date" TEXT NOT NULL,
  "due_date" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "order" INTEGER NOT NULL DEFAULT 0,
  "document_id" TEXT NOT NULL,
  "project_id" TEXT,
  "user_id" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "milestones_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "milestones_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX "milestones_document_id_idx" ON "milestones" ("document_id");

CREATE INDEX "milestones_project_id_idx" ON "milestones" ("project_id");

CREATE TABLE "office" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "slug" TEXT NOT NULL,
  "slug_history" TEXT NOT NULL DEFAULT '[]',
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "cover_image_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "logo_url" TEXT,
  "document_logo_url" TEXT,
  "document_footer_text" TEXT,
  "document_footer_note" TEXT,
  "document_footer_logo_url" TEXT,
  "document_letterhead_layout" TEXT,
  "document_letterhead_lines" TEXT,
  "document_letterhead_contact" TEXT,
  "document_letterhead_color" TEXT,
  "document_profile" TEXT,
  "document_letterhead_grid" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  CONSTRAINT "office_cover_image_id_generated_images_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "generated_images" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "office_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "office_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "office_org_slug_unique" ON "office" ("organization_id", "slug");

CREATE TABLE "office_users" (
  "user_id" TEXT NOT NULL,
  "office_id" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'viewer',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY ("user_id", "office_id"),
  CONSTRAINT "office_users_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "office" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "office_users_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "office_users_office_id_idx" ON "office_users" ("office_id");

CREATE INDEX "office_users_user_id_idx" ON "office_users" ("user_id");

CREATE TABLE "organization" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "slug" TEXT NOT NULL,
  "slug_history" TEXT NOT NULL DEFAULT '[]',
  "email_domains" TEXT NOT NULL DEFAULT '[]',
  "name" TEXT NOT NULL,
  "short_name" TEXT,
  "description" TEXT,
  "cover_image_id" TEXT,
  "country" TEXT,
  "type" TEXT NOT NULL DEFAULT 'personal',
  "status" TEXT NOT NULL DEFAULT 'active',
  "logo_url" TEXT,
  "document_logo_url" TEXT,
  "document_footer_text" TEXT,
  "document_footer_note" TEXT,
  "document_footer_logo_url" TEXT,
  "document_letterhead_layout" TEXT,
  "document_letterhead_lines" TEXT,
  "document_letterhead_contact" TEXT,
  "document_letterhead_color" TEXT,
  "document_profile" TEXT,
  "document_letterhead_grid" TEXT,
  "created_by" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  CONSTRAINT "organization_slug_unique" UNIQUE ("slug"),
  CONSTRAINT "organization_cover_image_id_generated_images_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "generated_images" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "organization_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE "organization_context" (
  "organization_id" TEXT PRIMARY KEY NOT NULL,
  "prompt" TEXT NOT NULL DEFAULT '',
  "updated_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "organization_context_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "organization_context_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE TABLE "organization_document" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "organization_id" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "original_filename" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "url" TEXT NOT NULL,
  "uploaded_by" TEXT,
  "is_pinned" INTEGER NOT NULL DEFAULT 0,
  "extracted_text" TEXT,
  "extraction_status" TEXT NOT NULL DEFAULT 'pending',
  "extraction_error" TEXT,
  "extracted_at" TEXT,
  "summary" TEXT,
  "summarized_at" TEXT,
  "letterhead_status" TEXT NOT NULL DEFAULT 'pending',
  "letterhead_analysis" TEXT,
  "letterhead_attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "organization_document_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "organization_document_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX "organization_document_extraction_status_idx" ON "organization_document" ("extraction_status");

CREATE INDEX "organization_document_letterhead_pending_idx" ON "organization_document" ("created_at" DESC) WHERE "letterhead_status" = 'pending';

CREATE INDEX "organization_document_organization_id_idx" ON "organization_document" ("organization_id");

CREATE TABLE "organization_memory" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "organization_id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "organization_memory_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "organization_memory_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "organization_memory_organization_id_idx" ON "organization_memory" ("organization_id");

CREATE TABLE "organization_signing_config" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "organization_id" TEXT NOT NULL,
  "documenso_api_url" TEXT NOT NULL,
  "documenso_api_key" TEXT NOT NULL,
  "documenso_webhook_secret" TEXT,
  "is_enabled" INTEGER NOT NULL DEFAULT 1,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "organization_signing_config_organization_id_unique" UNIQUE ("organization_id"),
  CONSTRAINT "organization_signing_config_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "organization_users" (
  "user_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'viewer',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY ("user_id", "organization_id"),
  CONSTRAINT "organization_users_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "organization_users_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "organization_users_organization_id_idx" ON "organization_users" ("organization_id");

CREATE INDEX "organization_users_user_id_idx" ON "organization_users" ("user_id");

CREATE TABLE "personal_access_token" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "token_prefix" TEXT NOT NULL,
  "last_used_at" TEXT,
  "expires_at" TEXT,
  "revoked_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "personal_access_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "pat_token_hash_idx" ON "personal_access_token" ("token_hash");

CREATE INDEX "pat_user_id_idx" ON "personal_access_token" ("user_id");

CREATE TABLE "profile" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "user_id" TEXT NOT NULL,
  "first_name" TEXT,
  "last_name" TEXT,
  "phone" TEXT,
  "city" TEXT,
  "street_address" TEXT,
  "unit_number" TEXT,
  "state" TEXT,
  "zip_code" TEXT,
  "avatar_url" TEXT,
  "job_title" TEXT,
  "user_role" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  CONSTRAINT "profile_user_id_unique" UNIQUE ("user_id"),
  CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE "project" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "slug" TEXT NOT NULL,
  "slug_history" TEXT NOT NULL DEFAULT '[]',
  "name" TEXT NOT NULL,
  "description" TEXT,
  "prompt" TEXT,
  "cover_image_id" TEXT,
  "office_id" TEXT NOT NULL,
  "created_by" TEXT NOT NULL,
  "last_modified_by" TEXT,
  "is_template" INTEGER NOT NULL DEFAULT 0,
  "parent_project_id" TEXT,
  "is_public" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'active',
  "ownership_status" TEXT NOT NULL DEFAULT 'draft',
  "intended_submission_organization_id" TEXT,
  "intended_submission_office_id" TEXT,
  "hidden_modules" TEXT NOT NULL DEFAULT '[]',
  "private_modules" TEXT NOT NULL DEFAULT '[]',
  "module_order" TEXT NOT NULL DEFAULT '[]',
  "module_columns" TEXT NOT NULL DEFAULT '{}',
  "is_research_phase_completed" INTEGER NOT NULL DEFAULT 0,
  "self_service_setup_pending_at" TEXT,
  "start_date" TEXT,
  "end_date" TEXT,
  "deleted_at" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  CONSTRAINT "project_cover_image_id_generated_images_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "generated_images" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "project_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "project_intended_submission_office_id_office_id_fk" FOREIGN KEY ("intended_submission_office_id") REFERENCES "office" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "project_intended_submission_organization_id_organization_id_fk" FOREIGN KEY ("intended_submission_organization_id") REFERENCES "organization" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "project_last_modified_by_user_id_fk" FOREIGN KEY ("last_modified_by") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "project_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "office" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "project_parent_project_id_project_id_fk" FOREIGN KEY ("parent_project_id") REFERENCES "project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX "project_office_slug_unique" ON "project" ("office_id", "slug");

CREATE INDEX "project_self_service_setup_pending_idx" ON "project" ("created_by") WHERE "self_service_setup_pending_at" is not null;

CREATE TABLE "project_context" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "project_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "url" TEXT,
  "created_by" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "project_context_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "project_context_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "project_context_project_id_idx" ON "project_context" ("project_id");

CREATE TABLE "project_document" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "project_id" TEXT NOT NULL,
  "user_id" TEXT,
  "filename" TEXT NOT NULL,
  "original_filename" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "url" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'upload',
  "relevance" INTEGER,
  "context" TEXT,
  "folder" TEXT,
  "folder_description" TEXT,
  "extracted_text" TEXT,
  "extraction_status" TEXT NOT NULL DEFAULT 'pending',
  "extraction_error" TEXT,
  "extracted_at" TEXT,
  "letterhead_status" TEXT NOT NULL DEFAULT 'pending',
  "letterhead_analysis" TEXT,
  "letterhead_attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "project_document_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "project_document_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX "project_document_extraction_status_idx" ON "project_document" ("extraction_status");

CREATE INDEX "project_document_letterhead_pending_idx" ON "project_document" ("created_at" DESC) WHERE "letterhead_status" = 'pending';

CREATE INDEX "project_document_project_id_idx" ON "project_document" ("project_id");

CREATE INDEX "project_document_user_id_idx" ON "project_document" ("user_id");

CREATE TABLE "project_field" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "project_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "is_required" INTEGER NOT NULL DEFAULT 0,
  "tooltip" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "values" TEXT NOT NULL DEFAULT '[]',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "project_field_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "project_field_project_id_idx" ON "project_field" ("project_id");

CREATE INDEX "project_field_project_id_order_idx" ON "project_field" ("project_id", "order");

CREATE TABLE "project_submission" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "project_id" TEXT NOT NULL,
  "target_organization_id" TEXT NOT NULL,
  "target_office_id" TEXT,
  "source_office_id" TEXT,
  "submitted_by" TEXT NOT NULL,
  "reviewed_by" TEXT,
  "reviewed_at" TEXT,
  "rejection_reason" TEXT,
  "created_at" TEXT NOT NULL,
  "updated_at" TEXT NOT NULL,
  CONSTRAINT "project_submission_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "project_submission_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "project_submission_source_office_id_office_id_fk" FOREIGN KEY ("source_office_id") REFERENCES "office" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "project_submission_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "project_submission_target_office_id_office_id_fk" FOREIGN KEY ("target_office_id") REFERENCES "office" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "project_submission_target_organization_id_organization_id_fk" FOREIGN KEY ("target_organization_id") REFERENCES "organization" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE "project_users" (
  "user_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'editor',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY ("user_id", "project_id"),
  CONSTRAINT "project_users_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "project_users_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "project_users_project_id_idx" ON "project_users" ("project_id");

CREATE INDEX "project_users_user_id_idx" ON "project_users" ("user_id");

CREATE TABLE "prompt" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "name" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT NOT NULL DEFAULT 'other',
  "versions" TEXT NOT NULL DEFAULT '[]',
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "prompt_name_unique" UNIQUE ("name")
);

CREATE TABLE "research_agent_chat" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "chat_id" TEXT NOT NULL,
  "external_run_id" TEXT,
  "webhook_secret" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "current_step" TEXT,
  "last_forwarded_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "research_agent_chat_chat_id_unique" UNIQUE ("chat_id"),
  CONSTRAINT "research_agent_chat_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "chat" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "research_agent_chat_webhook_secret_idx" ON "research_agent_chat" ("webhook_secret");

CREATE TABLE "research_agent_memories" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "keywords" TEXT NOT NULL,
  "run_id" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "research_agent_message" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "chat_id" TEXT NOT NULL,
  "research_agent_chat_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "data" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "research_agent_message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "chat" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "research_agent_message_research_agent_chat_id_research_agent_chat_id_fk" FOREIGN KEY ("research_agent_chat_id") REFERENCES "research_agent_chat" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE "research_agent_run_logs" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "run_id" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "research_agent_run_messages" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "run_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "sequence_number" INTEGER NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE "research_agent_runs" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "run_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'created',
  "prompt" TEXT NOT NULL,
  "skill" TEXT,
  "result_json" TEXT,
  "error_json" TEXT,
  "sandbox_id" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "research_agent_runs_run_id_unique" UNIQUE ("run_id")
);

CREATE TABLE "signing_request" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "document_id" TEXT NOT NULL,
  "project_id" TEXT NOT NULL,
  "user_id" TEXT,
  "envelope_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "signing_mode" TEXT NOT NULL DEFAULT 'parallel',
  "title" TEXT NOT NULL,
  "recipients" TEXT NOT NULL,
  "signed_document_url" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "signing_request_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "signing_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX "signing_request_document_id_idx" ON "signing_request" ("document_id");

CREATE INDEX "signing_request_envelope_id_idx" ON "signing_request" ("envelope_id");

CREATE INDEX "signing_request_project_id_idx" ON "signing_request" ("project_id");

CREATE INDEX "signing_request_user_id_idx" ON "signing_request" ("user_id");

CREATE TABLE "subscription" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "organization_id" TEXT NOT NULL,
  "stripe_customer_id" TEXT,
  "stripe_subscription_id" TEXT,
  "stripe_base_item_id" TEXT,
  "stripe_seat_item_id" TEXT,
  "stripe_overage_item_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'incomplete',
  "plan" TEXT,
  "seats" INTEGER NOT NULL DEFAULT 1,
  "trial_end" TEXT,
  "trial_used_at" TEXT,
  "current_period_start" TEXT,
  "current_period_end" TEXT,
  "plan_chosen_at" TEXT,
  "discount_percent_off" INTEGER,
  "discount_ends_at" TEXT,
  "discount_notice_30_sent_at" TEXT,
  "discount_notice_7_sent_at" TEXT,
  "cancel_at_period_end" INTEGER NOT NULL DEFAULT 0,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "subscription_organization_id_unique" UNIQUE ("organization_id"),
  CONSTRAINT "subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "subscription_discount_percent_range" CHECK ("discount_percent_off" IS NULL OR ("discount_percent_off" >= 0 AND "discount_percent_off" <= 100)),
  CONSTRAINT "subscription_seats_non_negative" CHECK ("seats" >= 0)
);

CREATE TABLE "suggestion" (
  "id" TEXT NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "document_id" TEXT NOT NULL,
  "document_created_at" TEXT NOT NULL,
  "original_text" TEXT NOT NULL,
  "suggested_text" TEXT NOT NULL,
  "description" TEXT,
  "is_resolved" INTEGER NOT NULL DEFAULT 0,
  "user_id" TEXT NOT NULL,
  "created_at" TEXT NOT NULL,
  PRIMARY KEY ("id"),
  CONSTRAINT "suggestion_document_id_document_created_at_document_id_created_at_fk" FOREIGN KEY ("document_id", "document_created_at") REFERENCES "document" ("id", "created_at") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "suggestion_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE TABLE "tasks" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "assignee_ids" TEXT DEFAULT '{}',
  "dependencies" TEXT DEFAULT '{}',
  "start_date" TEXT NOT NULL,
  "due_date" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "order" INTEGER NOT NULL DEFAULT 0,
  "milestone_id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "project_document_ids" TEXT DEFAULT '{}',
  "user_id" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updated_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "tasks_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "milestones" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "tasks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX "tasks_milestone_id_idx" ON "tasks" ("milestone_id");

CREATE TABLE "timeline_record" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "project_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "entity_name" TEXT,
  "action" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "changes" TEXT,
  "resource_urls" TEXT,
  "is_public" INTEGER NOT NULL DEFAULT 0,
  "metadata" TEXT,
  "started_at" TEXT,
  "ended_at" TEXT,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "deleted_at" TEXT,
  CONSTRAINT "timeline_record_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "timeline_record_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX "idx_timeline_record_created_at" ON "timeline_record" ("created_at");

CREATE INDEX "idx_timeline_record_entity" ON "timeline_record" ("entity_type", "entity_id");

CREATE INDEX "idx_timeline_record_project_created" ON "timeline_record" ("project_id", "created_at");

CREATE INDEX "idx_timeline_record_project_id" ON "timeline_record" ("project_id");

CREATE INDEX "idx_timeline_record_stats" ON "timeline_record" ("project_id", "entity_type", "action");

CREATE TABLE "user" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "email" TEXT NOT NULL,
  "email_verified" TEXT
);

CREATE TABLE "verification_token" (
  "user_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "expires" TEXT NOT NULL,
  PRIMARY KEY ("user_id", "token"),
  CONSTRAINT "verification_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX "verification_token_expires_idx" ON "verification_token" ("expires");

CREATE TABLE "webhook_request_log" (
  "id" TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  "source" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "request_body" TEXT,
  "request_headers" TEXT,
  "response_body" TEXT,
  "response_status" INTEGER NOT NULL,
  "run_id" TEXT,
  "duration_ms" INTEGER NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX "webhook_request_log_created_at_idx" ON "webhook_request_log" ("created_at");

CREATE INDEX "webhook_request_log_run_id_idx" ON "webhook_request_log" ("run_id");

CREATE INDEX "webhook_request_log_source_idx" ON "webhook_request_log" ("source");
