ALTER TABLE "office" ADD COLUMN "document_letterhead_layout" varchar;--> statement-breakpoint
ALTER TABLE "office" ADD COLUMN "document_letterhead_lines" text;--> statement-breakpoint
ALTER TABLE "office" ADD COLUMN "document_letterhead_contact" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "document_letterhead_layout" varchar;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "document_letterhead_lines" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "document_letterhead_contact" text;