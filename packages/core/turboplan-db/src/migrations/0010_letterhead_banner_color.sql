ALTER TABLE "document_letterhead" ADD COLUMN "color" varchar(7);--> statement-breakpoint
ALTER TABLE "office" ADD COLUMN "document_letterhead_color" varchar(7);--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "document_letterhead_color" varchar(7);