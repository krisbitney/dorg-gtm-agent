CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"platform" varchar(50) NOT NULL,
	"content" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"lead_probability" double precision,
	"why_fit" text,
	"needs" text,
	"timing" text,
	"contact_info" text,
	"dorg_lead_id" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leads_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "search_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"search_query" text NOT NULL,
	"site" text NOT NULL,
	"status" varchar(50) DEFAULT 'searching' NOT NULL,
	"results_found" integer DEFAULT 0 NOT NULL,
	"results_imported" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "url_idx" ON "leads" USING btree ("url");