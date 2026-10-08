CREATE TABLE "document_letterhead" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"layout" varchar DEFAULT 'split' NOT NULL,
	"lines" text DEFAULT '' NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"logo_url" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_letterhead_selection" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"letterhead_id" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "document_letterhead" ADD CONSTRAINT "document_letterhead_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_letterhead" ADD CONSTRAINT "document_letterhead_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_letterhead_selection" ADD CONSTRAINT "document_letterhead_selection_letterhead_id_document_letterhead_id_fk" FOREIGN KEY ("letterhead_id") REFERENCES "public"."document_letterhead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_letterhead_selection" ADD CONSTRAINT "document_letterhead_selection_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_letterhead_organization_id_idx" ON "document_letterhead" USING btree ("organization_id");