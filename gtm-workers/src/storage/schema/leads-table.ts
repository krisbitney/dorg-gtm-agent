import {pgTable, text, uuid, timestamp, doublePrecision, index, varchar, integer, jsonb} from "drizzle-orm/pg-core";
import { LeadStatus } from "../../constants/lead-status.js";

/**
 * Drizzle schema for the leads table.
 * Stores data extracted from platforms and tracks its progress through the AI and dOrg pipeline.
 */
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey(),
  url: text("url").notNull().unique(),
  platform: varchar("platform", { length: 50 }).notNull(),
  content: jsonb("content").notNull(),
  status: varchar("status", { length: 50 }).notNull().default(LeadStatus.PENDING),
  leadProbability: doublePrecision("lead_probability"),
  whyFit: text("why_fit"),
  needs: text("needs"),
  timing: text("timing"),
  contactInfo: text("contact_info"),
  dorgLeadId: text("dorg_lead_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => {
  return {
    statusIndex: index("status_idx").on(table.status),
    urlIndex: index("url_idx").on(table.url),
  };
});

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
