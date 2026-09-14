CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('project', 'office', 'organization');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('government_agency', 'environmental_planning', 'citizen');--> statement-breakpoint
CREATE TYPE "public"."empty_state_section" AS ENUM('tasks', 'documents');--> statement-breakpoint
CREATE TYPE "public"."layer_type_enum" AS ENUM('project_boundary', 'units_boundary');--> statement-breakpoint
CREATE TYPE "public"."project_field_type" AS ENUM('text', 'list');--> statement-breakpoint
CREATE TYPE "public"."signing_mode" AS ENUM('parallel', 'sequential');--> statement-breakpoint
CREATE TYPE "public"."signing_request_status" AS ENUM('draft', 'pending', 'completed', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invitation_entity_type" AS ENUM('organization', 'office', 'project');--> statement-breakpoint
CREATE TYPE "public"."invitation_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."office_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."office_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."organization_status" AS ENUM('active', 'draft', 'archived');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('personal', 'business', 'nonprofit', 'government', 'demo', 'internal', 'environmental_planner');--> statement-breakpoint
CREATE TYPE "public"."organization_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."ownership_status" AS ENUM('draft', 'submitted', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'archived', 'completed');--> statement-breakpoint
CREATE TYPE "public"."project_role" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('starter', 'pro', 'max', 'grandfather');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid');--> statement-breakpoint
CREATE TABLE "admin_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "admin_user_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "ai_model_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"primary_model" varchar(255),
	"lite_model" varchar(255),
	"image_primary_model" varchar(255),
	"image_lite_model" varchar(255),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp,
	"title" text NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"is_initial" boolean DEFAULT false NOT NULL,
	"visibility" varchar DEFAULT 'private' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"kind" varchar DEFAULT 'text' NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_id" uuid,
	CONSTRAINT "document_id_created_at_pk" PRIMARY KEY("id","created_at")
);
--> statement-breakpoint
CREATE TABLE "generated_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"image_url" text NOT NULL,
	"prompt" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"role" varchar NOT NULL,
	"parts" json NOT NULL,
	"attachments" json NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_access_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"actor" varchar(100) NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"token_prefix" varchar(12) NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"first_name" varchar(50),
	"last_name" varchar(50),
	"phone" varchar(20),
	"city" varchar(100),
	"street_address" text,
	"unit_number" varchar(20),
	"state" varchar(50),
	"zip_code" varchar(10),
	"avatar_url" text,
	"job_title" varchar(100),
	"user_role" "user_role",
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "prompt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(50) DEFAULT 'other' NOT NULL,
	"versions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "suggestion" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"document_created_at" timestamp NOT NULL,
	"original_text" text NOT NULL,
	"suggested_text" text NOT NULL,
	"description" text,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "suggestion_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(64) NOT NULL,
	"email_verified" timestamp
);
--> statement-breakpoint
CREATE TABLE "verification_token" (
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"type" varchar(20) NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_token_user_id_token_pk" PRIMARY KEY("user_id","token")
);
--> statement-breakpoint
CREATE TABLE "cataloger_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cataloger_run_id" uuid NOT NULL,
	"project_id" uuid,
	"organization_id" uuid,
	"office_id" uuid,
	"name" varchar(255) NOT NULL,
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cataloger_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"message" text NOT NULL,
	"external_run_id" varchar(255),
	"webhook_secret" varchar(128) NOT NULL,
	"status" varchar(50) DEFAULT 'initializing' NOT NULL,
	"current_step" text,
	"entries_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_comment_id" uuid,
	"content" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"is_auto_response" boolean DEFAULT false NOT NULL,
	"target_user_id" uuid,
	"auto_responder_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empty_state_suggestion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"section" "empty_state_section" NOT NULL,
	"label" text NOT NULL,
	"content" text NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "map_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"layer_id" uuid NOT NULL,
	"geometry" geometry,
	"feature_name" varchar(255),
	"feature_type" varchar(100),
	"properties" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "map_layers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"layer_name" varchar(255) NOT NULL,
	"source_filename" varchar(255) NOT NULL,
	"file_type" varchar(20) NOT NULL,
	"layer_type" "layer_type_enum" DEFAULT 'project_boundary' NOT NULL,
	"feature_count" integer DEFAULT 0 NOT NULL,
	"properties_list" jsonb,
	"unit_id_key" varchar(100),
	"unit_acres_key" varchar(100),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_context" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"label" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"url" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid,
	"filename" varchar(255) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" bigint NOT NULL,
	"url" text NOT NULL,
	"source" varchar(20) DEFAULT 'upload' NOT NULL,
	"relevance" integer,
	"context" text,
	"folder" varchar(255),
	"folder_description" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_field" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "project_field_type" NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"tooltip" varchar(500),
	"order" integer DEFAULT 0 NOT NULL,
	"values" json DEFAULT '[]'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_agent_chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"external_run_id" varchar(255),
	"webhook_secret" varchar(128) NOT NULL,
	"status" varchar(50) DEFAULT 'queued' NOT NULL,
	"current_step" text,
	"last_forwarded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "research_agent_chat_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
CREATE TABLE "research_agent_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"research_agent_chat_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_agent_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"keywords" text[] NOT NULL,
	"run_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_agent_run_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_agent_run_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"sequence_number" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "research_agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"prompt" text NOT NULL,
	"skill" text,
	"result_json" text,
	"error_json" text,
	"sandbox_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "research_agent_runs_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "signing_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid,
	"envelope_id" varchar(255),
	"status" "signing_request_status" DEFAULT 'draft' NOT NULL,
	"signing_mode" "signing_mode" DEFAULT 'parallel' NOT NULL,
	"title" varchar(500) NOT NULL,
	"recipients" jsonb NOT NULL,
	"signed_document_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"assignee_ids" text[] DEFAULT '{}',
	"start_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"document_id" uuid NOT NULL,
	"project_id" uuid,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"assignee_ids" text[] DEFAULT '{}',
	"dependencies" text[] DEFAULT '{}',
	"start_date" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"milestone_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"project_document_ids" text[] DEFAULT '{}',
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_name" text,
	"action" text NOT NULL,
	"title" text,
	"description" text,
	"changes" json,
	"resource_urls" json,
	"is_public" boolean DEFAULT false NOT NULL,
	"metadata" json,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "webhook_request_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) NOT NULL,
	"path" varchar(500) NOT NULL,
	"method" varchar(10) NOT NULL,
	"request_body" jsonb,
	"request_headers" jsonb,
	"response_body" jsonb,
	"response_status" integer NOT NULL,
	"run_id" varchar(255),
	"duration_ms" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_credit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"amount" integer NOT NULL,
	"source" varchar(50) NOT NULL,
	"model" varchar(255),
	"cost_usd" numeric(12, 6),
	"overage_credits" integer DEFAULT 0 NOT NULL,
	"stripe_meter_reported_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_credit_event_amount_non_negative" CHECK ("billing_credit_event"."amount" >= 0),
	CONSTRAINT "billing_credit_event_overage_non_negative" CHECK ("billing_credit_event"."overage_credits" >= 0)
);
--> statement-breakpoint
CREATE TABLE "billing_credit_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"alert70_sent_at" timestamp,
	"alert90_sent_at" timestamp,
	"alert100_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_credit_usage_org_period_unique" UNIQUE("organization_id","period_start"),
	CONSTRAINT "billing_credit_usage_credits_used_non_negative" CHECK ("billing_credit_usage"."credits_used" >= 0)
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(64) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "invitation_role" DEFAULT 'viewer' NOT NULL,
	"entity_type" "invitation_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"invited_by" uuid NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"task_assignment" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "office" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(40) NOT NULL,
	"slug_history" json DEFAULT '[]'::json NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"cover_image_id" uuid,
	"status" "office_status" DEFAULT 'active' NOT NULL,
	"logo_url" text,
	"document_logo_url" text,
	"document_footer_text" text,
	"document_footer_note" text,
	"document_footer_logo_url" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "office_users" (
	"user_id" uuid NOT NULL,
	"office_id" uuid NOT NULL,
	"role" "office_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "office_users_user_id_office_id_pk" PRIMARY KEY("user_id","office_id")
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(40) NOT NULL,
	"slug_history" json DEFAULT '[]'::json NOT NULL,
	"email_domains" json DEFAULT '[]'::json NOT NULL,
	"name" varchar(255) NOT NULL,
	"short_name" varchar(20),
	"description" text,
	"cover_image_id" uuid,
	"country" varchar(100),
	"type" "organization_type" DEFAULT 'personal' NOT NULL,
	"status" "organization_status" DEFAULT 'active' NOT NULL,
	"logo_url" text,
	"document_logo_url" text,
	"document_footer_text" text,
	"document_footer_note" text,
	"document_footer_logo_url" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "organization_signing_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"documenso_api_url" varchar(500) NOT NULL,
	"documenso_api_key" text NOT NULL,
	"documenso_webhook_secret" text,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_signing_config_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "organization_users" (
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "organization_role" DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_users_user_id_organization_id_pk" PRIMARY KEY("user_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(40) NOT NULL,
	"slug_history" json DEFAULT '[]'::json NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"prompt" text,
	"cover_image_id" uuid,
	"office_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"last_modified_by" uuid,
	"is_template" boolean DEFAULT false NOT NULL,
	"parent_project_id" uuid,
	"is_public" boolean DEFAULT false NOT NULL,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"ownership_status" "ownership_status" DEFAULT 'draft' NOT NULL,
	"intended_submission_organization_id" uuid,
	"intended_submission_office_id" uuid,
	"hidden_modules" json DEFAULT '[]'::json NOT NULL,
	"private_modules" json DEFAULT '[]'::json NOT NULL,
	"module_order" json DEFAULT '[]'::json NOT NULL,
	"module_columns" json DEFAULT '{}'::json NOT NULL,
	"is_research_phase_completed" boolean DEFAULT false NOT NULL,
	"self_service_setup_pending_at" timestamp,
	"start_date" timestamp,
	"end_date" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"target_organization_id" uuid NOT NULL,
	"target_office_id" uuid,
	"source_office_id" uuid,
	"submitted_by" uuid NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_users" (
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"role" "project_role" DEFAULT 'editor' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_users_user_id_project_id_pk" PRIMARY KEY("user_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"stripe_base_item_id" varchar(255),
	"stripe_seat_item_id" varchar(255),
	"stripe_overage_item_id" varchar(255),
	"status" "subscription_status" DEFAULT 'incomplete' NOT NULL,
	"plan" "subscription_plan",
	"seats" integer DEFAULT 1 NOT NULL,
	"trial_end" timestamp,
	"trial_used_at" timestamp,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"plan_chosen_at" timestamp,
	"discount_percent_off" integer,
	"discount_ends_at" timestamp,
	"discount_notice_30_sent_at" timestamp,
	"discount_notice_7_sent_at" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "subscription_seats_non_negative" CHECK ("subscription"."seats" >= 0),
	CONSTRAINT "subscription_discount_percent_range" CHECK ("subscription"."discount_percent_off" IS NULL OR ("subscription"."discount_percent_off" >= 0 AND "subscription"."discount_percent_off" <= 100))
);
--> statement-breakpoint
ALTER TABLE "admin_user" ADD CONSTRAINT "admin_user_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_user" ADD CONSTRAINT "admin_user_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model_config" ADD CONSTRAINT "ai_model_config_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_images" ADD CONSTRAINT "generated_images_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_access_token" ADD CONSTRAINT "personal_access_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion" ADD CONSTRAINT "suggestion_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion" ADD CONSTRAINT "suggestion_document_id_document_created_at_document_id_created_at_fk" FOREIGN KEY ("document_id","document_created_at") REFERENCES "public"."document"("id","created_at") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_token" ADD CONSTRAINT "verification_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cataloger_entry" ADD CONSTRAINT "cataloger_entry_cataloger_run_id_cataloger_run_id_fk" FOREIGN KEY ("cataloger_run_id") REFERENCES "public"."cataloger_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cataloger_entry" ADD CONSTRAINT "cataloger_entry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cataloger_entry" ADD CONSTRAINT "cataloger_entry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cataloger_entry" ADD CONSTRAINT "cataloger_entry_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cataloger_run" ADD CONSTRAINT "cataloger_run_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empty_state_suggestion" ADD CONSTRAINT "empty_state_suggestion_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_features" ADD CONSTRAINT "map_features_layer_id_map_layers_id_fk" FOREIGN KEY ("layer_id") REFERENCES "public"."map_layers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "map_layers" ADD CONSTRAINT "map_layers_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_context" ADD CONSTRAINT "project_context_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_context" ADD CONSTRAINT "project_context_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document" ADD CONSTRAINT "project_document_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document" ADD CONSTRAINT "project_document_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_field" ADD CONSTRAINT "project_field_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_agent_chat" ADD CONSTRAINT "research_agent_chat_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_agent_message" ADD CONSTRAINT "research_agent_message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_agent_message" ADD CONSTRAINT "research_agent_message_research_agent_chat_id_research_agent_chat_id_fk" FOREIGN KEY ("research_agent_chat_id") REFERENCES "public"."research_agent_chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_request" ADD CONSTRAINT "signing_request_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_request" ADD CONSTRAINT "signing_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_record" ADD CONSTRAINT "timeline_record_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_record" ADD CONSTRAINT "timeline_record_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_credit_event" ADD CONSTRAINT "billing_credit_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_credit_event" ADD CONSTRAINT "billing_credit_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_credit_usage" ADD CONSTRAINT "billing_credit_usage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office" ADD CONSTRAINT "office_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office" ADD CONSTRAINT "office_cover_image_id_generated_images_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."generated_images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office" ADD CONSTRAINT "office_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_users" ADD CONSTRAINT "office_users_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_users" ADD CONSTRAINT "office_users_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_cover_image_id_generated_images_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."generated_images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_signing_config" ADD CONSTRAINT "organization_signing_config_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_cover_image_id_generated_images_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."generated_images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_office_id_office_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."office"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_last_modified_by_user_id_fk" FOREIGN KEY ("last_modified_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_parent_project_id_project_id_fk" FOREIGN KEY ("parent_project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_intended_submission_organization_id_organization_id_fk" FOREIGN KEY ("intended_submission_organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_intended_submission_office_id_office_id_fk" FOREIGN KEY ("intended_submission_office_id") REFERENCES "public"."office"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_submission" ADD CONSTRAINT "project_submission_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_submission" ADD CONSTRAINT "project_submission_target_organization_id_organization_id_fk" FOREIGN KEY ("target_organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_submission" ADD CONSTRAINT "project_submission_target_office_id_office_id_fk" FOREIGN KEY ("target_office_id") REFERENCES "public"."office"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_submission" ADD CONSTRAINT "project_submission_source_office_id_office_id_fk" FOREIGN KEY ("source_office_id") REFERENCES "public"."office"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_submission" ADD CONSTRAINT "project_submission_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_submission" ADD CONSTRAINT "project_submission_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_users" ADD CONSTRAINT "project_users_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_users" ADD CONSTRAINT "project_users_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_project_id_idx" ON "chat" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "chat_project_id_updated_at_idx" ON "chat" USING btree ("project_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_one_initial_per_project_idx" ON "chat" USING btree ("project_id") WHERE is_initial = true;--> statement-breakpoint
CREATE INDEX "document_chat_id_idx" ON "document" USING btree ("chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pat_token_hash_idx" ON "personal_access_token" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "pat_user_id_idx" ON "personal_access_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_token_expires_idx" ON "verification_token" USING btree ("expires");--> statement-breakpoint
CREATE INDEX "cataloger_entry_run_id_idx" ON "cataloger_entry" USING btree ("cataloger_run_id");--> statement-breakpoint
CREATE INDEX "cataloger_run_user_id_idx" ON "cataloger_run" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cataloger_run_external_run_id_idx" ON "cataloger_run" USING btree ("external_run_id");--> statement-breakpoint
CREATE INDEX "cataloger_run_webhook_secret_idx" ON "cataloger_run" USING btree ("webhook_secret");--> statement-breakpoint
CREATE INDEX "comment_project_id_idx" ON "comment" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "comment_parent_comment_id_idx" ON "comment" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "features_geometry_spatial_idx" ON "map_features" USING gist ("geometry");--> statement-breakpoint
CREATE INDEX "map_layers_project_id_idx" ON "map_layers" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_context_project_id_idx" ON "project_context" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_document_project_id_idx" ON "project_document" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_document_user_id_idx" ON "project_document" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_field_project_id_idx" ON "project_field" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_field_project_id_order_idx" ON "project_field" USING btree ("project_id","order");--> statement-breakpoint
CREATE INDEX "research_agent_chat_webhook_secret_idx" ON "research_agent_chat" USING btree ("webhook_secret");--> statement-breakpoint
CREATE INDEX "signing_request_project_id_idx" ON "signing_request" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "signing_request_document_id_idx" ON "signing_request" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "signing_request_envelope_id_idx" ON "signing_request" USING btree ("envelope_id");--> statement-breakpoint
CREATE INDEX "signing_request_user_id_idx" ON "signing_request" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "milestones_project_id_idx" ON "milestones" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "milestones_document_id_idx" ON "milestones" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "tasks_milestone_id_idx" ON "tasks" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "idx_timeline_record_project_id" ON "timeline_record" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_timeline_record_created_at" ON "timeline_record" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_timeline_record_entity" ON "timeline_record" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_timeline_record_project_created" ON "timeline_record" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_timeline_record_stats" ON "timeline_record" USING btree ("project_id","entity_type","action");--> statement-breakpoint
CREATE INDEX "webhook_request_log_source_idx" ON "webhook_request_log" USING btree ("source");--> statement-breakpoint
CREATE INDEX "webhook_request_log_run_id_idx" ON "webhook_request_log" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "webhook_request_log_created_at_idx" ON "webhook_request_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "billing_credit_event_org_created_idx" ON "billing_credit_event" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "invitations_token_idx" ON "invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invitations_entity_idx" ON "invitations" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitations_status_idx" ON "invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invitations_invited_by_idx" ON "invitations" USING btree ("invited_by");--> statement-breakpoint
CREATE UNIQUE INDEX "office_org_slug_unique" ON "office" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "office_name_trgm_idx" ON "office" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "office_description_trgm_idx" ON "office" USING gin (coalesce("description", '') gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "office_users_user_id_idx" ON "office_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "office_users_office_id_idx" ON "office_users" USING btree ("office_id");--> statement-breakpoint
CREATE INDEX "organization_name_trgm_idx" ON "organization" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "organization_short_name_trgm_idx" ON "organization" USING gin (coalesce("short_name", '') gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "organization_description_trgm_idx" ON "organization" USING gin (coalesce("description", '') gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "organization_users_user_id_idx" ON "organization_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organization_users_organization_id_idx" ON "organization_users" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_office_slug_unique" ON "project" USING btree ("office_id","slug");--> statement-breakpoint
CREATE INDEX "project_name_trgm_idx" ON "project" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "project_description_trgm_idx" ON "project" USING gin (coalesce("description", '') gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "project_self_service_setup_pending_idx" ON "project" USING btree ("created_by") WHERE "project"."self_service_setup_pending_at" is not null;--> statement-breakpoint
CREATE INDEX "project_users_user_id_idx" ON "project_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_users_project_id_idx" ON "project_users" USING btree ("project_id");