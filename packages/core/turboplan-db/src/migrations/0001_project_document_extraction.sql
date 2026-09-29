ALTER TABLE "project_document" ADD COLUMN "extracted_text" text;--> statement-breakpoint
ALTER TABLE "project_document" ADD COLUMN "extraction_status" varchar(20) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_document" ADD COLUMN "extraction_error" text;--> statement-breakpoint
ALTER TABLE "project_document" ADD COLUMN "extracted_at" timestamp;--> statement-breakpoint
CREATE INDEX "project_document_extraction_status_idx" ON "project_document" USING btree ("extraction_status");