CREATE TABLE "document_own_letterhead" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"letterhead" jsonb NOT NULL,
	"reference_filename" text NOT NULL,
	"reference_project_document_id" uuid,
	"reference_organization_document_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "document_own_letterhead_single_reference" CHECK (num_nonnulls("document_own_letterhead"."reference_project_document_id", "document_own_letterhead"."reference_organization_document_id") <= 1)
);
--> statement-breakpoint
ALTER TABLE "project_document" ADD COLUMN "letterhead_status" varchar(20) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_document" ADD COLUMN "letterhead_analysis" jsonb;--> statement-breakpoint
ALTER TABLE "project_document" ADD COLUMN "letterhead_attempts" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "document_letterhead_selection" ADD COLUMN "use_own" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "office" ADD COLUMN "document_letterhead_grid" jsonb;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "document_letterhead_grid" jsonb;--> statement-breakpoint
ALTER TABLE "organization_document" ADD COLUMN "letterhead_status" varchar(20) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_document" ADD COLUMN "letterhead_analysis" jsonb;--> statement-breakpoint
ALTER TABLE "organization_document" ADD COLUMN "letterhead_attempts" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "document_own_letterhead" ADD CONSTRAINT "document_own_letterhead_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_own_letterhead" ADD CONSTRAINT "document_own_letterhead_reference_project_document_fk" FOREIGN KEY ("reference_project_document_id") REFERENCES "public"."project_document"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_own_letterhead" ADD CONSTRAINT "document_own_letterhead_reference_organization_document_fk" FOREIGN KEY ("reference_organization_document_id") REFERENCES "public"."organization_document"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_own_letterhead_reference_project_document_idx" ON "document_own_letterhead" USING btree ("reference_project_document_id") WHERE "document_own_letterhead"."reference_project_document_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "document_own_letterhead_reference_organization_document_idx" ON "document_own_letterhead" USING btree ("reference_organization_document_id") WHERE "document_own_letterhead"."reference_organization_document_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "project_document_letterhead_pending_idx" ON "project_document" USING btree ("created_at" DESC NULLS FIRST) WHERE "project_document"."letterhead_status" = 'pending';--> statement-breakpoint
CREATE INDEX "organization_document_letterhead_pending_idx" ON "organization_document" USING btree ("created_at" DESC NULLS FIRST) WHERE "organization_document"."letterhead_status" = 'pending';--> statement-breakpoint
ALTER TABLE "document_letterhead_selection" ADD CONSTRAINT "document_letterhead_selection_use_own_without_letterhead" CHECK (NOT "document_letterhead_selection"."use_own" OR "document_letterhead_selection"."letterhead_id" IS NULL);