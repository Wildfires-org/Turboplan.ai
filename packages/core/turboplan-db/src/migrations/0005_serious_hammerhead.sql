CREATE TABLE "organization_context" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"filename" varchar(255) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" bigint NOT NULL,
	"url" text NOT NULL,
	"uploaded_by" uuid,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"extracted_text" text,
	"extraction_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"extraction_error" text,
	"extracted_at" timestamp,
	"summary" text,
	"summarized_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_context" ADD CONSTRAINT "organization_context_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_context" ADD CONSTRAINT "organization_context_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_document" ADD CONSTRAINT "organization_document_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_document" ADD CONSTRAINT "organization_document_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_document_organization_id_idx" ON "organization_document" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_document_extraction_status_idx" ON "organization_document" USING btree ("extraction_status");