import {pgTable, text, uuid, timestamp, doublePrecision, index, varchar, integer, jsonb} from "drizzle-orm/pg-core";
import { PostStatus } from "../../constants/post-status.js";

/**
 * Drizzle schema for the posts table.
 * Stores data extracted from platforms and tracks its progress through the AI and dOrg pipeline.
 */
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey(),
  url: text("url").notNull().unique(),
  platform: varchar("platform", { length: 50 }).notNull(),
  post: jsonb("post").notNull(),
  status: varchar("status", { length: 50 }).notNull().default(PostStatus.PENDING),
  leadProbability: doublePrecision("lead_probability"),
  whyFit: text("why_fit"),
  needs: text("needs"),
  timing: text("timing"),
  contactInfo: text("contact_info"),
  dorgLeadId: text("dorg_lead_id"),
  errorMessage: text("error_message"),
  apifyRunId: text("apify_run_id"),
  apifyDatasetId: text("apify_dataset_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    statusIndex: index("status_idx").on(table.status),
    urlIndex: index("url_idx").on(table.url),
  };
});

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
