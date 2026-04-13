ALTER TABLE "crawl_runs" ADD COLUMN "platform" text DEFAULT 'reddit' NOT NULL;--> statement-breakpoint
ALTER TABLE "crawl_runs" ADD COLUMN "input" jsonb;
