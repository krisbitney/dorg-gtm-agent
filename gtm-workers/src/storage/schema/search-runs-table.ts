import { pgTable, text, timestamp, varchar, integer, uuid } from "drizzle-orm/pg-core";
import { SearchRunStatus } from "../../constants/search-run-status.js";

export const searchRuns = pgTable("search_runs", {
  id: uuid("id").primaryKey(),
  searchQuery: text("search_query").notNull(),
  site: text("site").notNull(),
  status: varchar("status", { length: 50 }).notNull().default(SearchRunStatus.SEARCHING),
  resultsFound: integer("results_found").notNull().default(0),
  resultsImported: integer("results_imported").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SearchRun = typeof searchRuns.$inferSelect;
export type NewSearchRun = typeof searchRuns.$inferInsert;
