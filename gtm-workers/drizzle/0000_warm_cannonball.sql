CREATE TABLE "crawl_runs" (
	"apify_run_id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"status" varchar(50) DEFAULT 'started' NOT NULL,
	"default_dataset_id" text,
	"source" text,
	"error_message" text,
	"items_read" integer DEFAULT 0 NOT NULL,
	"items_imported" integer DEFAULT 0 NOT NULL,
	"duplicates_skipped" integer DEFAULT 0 NOT NULL,
	"invalid_items" integer DEFAULT 0 NOT NULL,
	"failed_items" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"webhook_received_at" timestamp,
	"import_started_at" timestamp,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"platform" varchar(50) NOT NULL,
	"post" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"lead_probability" double precision,
	"why_fit" text,
	"needs" text,
	"timing" text,
	"contact_info" text,
	"dorg_lead_id" text,
	"error_message" text,
	"apify_run_id" text,
	"apify_dataset_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "posts_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE INDEX "status_idx" ON "posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "url_idx" ON "posts" USING btree ("url");
