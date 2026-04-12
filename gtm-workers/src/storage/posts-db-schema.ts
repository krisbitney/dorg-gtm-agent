import { pgTable, text, uuid, timestamp, integer, varchar } from "drizzle-orm/pg-core";

/**
 * Drizzle schema for the posts table.
 * Stores raw data extracted from Reddit (or other platforms) before AI processing.
 */
export const posts = pgTable("posts", {
    id: uuid("id").primaryKey(),
    url: text("url").notNull().unique(), // Canonical URL
    rawUrl: text("raw_url"), // Original URL before normalization
    platform: varchar("platform", { length: 50 }).notNull(), // 'reddit'
    topic: text("topic").notNull(), // e.g., 'CryptoCurrency'
    username: text("username").notNull(),
    content: text("content").notNull(),
    postedAt: timestamp("posted_at"), // Post creation time
    likes: integer("likes"),
    nComments: integer("n_comments"),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").notNull().defaultNow(), // Crawl time
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
