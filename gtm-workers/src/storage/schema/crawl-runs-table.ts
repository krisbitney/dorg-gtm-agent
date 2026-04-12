import { pgTable, text, timestamp, varchar, integer } from "drizzle-orm/pg-core";
import { CrawlRunStatus } from "../../constants/crawl-run-status.js";

/**
 * Drizzle schema for the crawl_runs table.
 * Tracks Apify actor runs and their results.
 */
export const crawlRuns = pgTable("crawl_runs", {
  apifyRunId: text("apify_run_id").primaryKey(),
  actorId: text("actor_id").notNull(),
  status: varchar("status", { length: 50 }).notNull().default(CrawlRunStatus.STARTED),
  defaultDatasetId: text("default_dataset_id"),
  source: text("source"),
  errorMessage: text("error_message"),
  itemsRead: integer("items_read").notNull().default(0),
  itemsImported: integer("items_imported").notNull().default(0),
  duplicatesSkipped: integer("duplicates_skipped").notNull().default(0),
  invalidItems: integer("invalid_items").notNull().default(0),
  failedItems: integer("failed_items").notNull().default(0),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  webhookReceivedAt: timestamp("webhook_received_at"),
  importStartedAt: timestamp("import_started_at"),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CrawlRun = typeof crawlRuns.$inferSelect;
export type NewCrawlRun = typeof crawlRuns.$inferInsert;
