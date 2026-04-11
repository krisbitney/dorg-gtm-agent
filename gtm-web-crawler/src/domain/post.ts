import type { ExtractedRedditPost } from "./reddit.js";

/**
 * Supported platforms for crawling.
 */
export type Platform = "reddit";

/**
 * Status of a post in the database.
 */
export type CrawlStatus = "pending" | "error";

/**
 * The full record stored in the SQL database before processing.
 */
export interface PendingPostRecord extends ExtractedRedditPost {
  id: string; // UUIDv7
  url: string;
  platform: Platform;
  status: CrawlStatus;
  createdAt: Date;
}

/**
 * The payload sent to the Redis queue for workers to process.
 */
export interface QueuePayload {
  id: string; // UUIDv7
  platform: Platform;
}

/**
 * Possible outcomes for processing a single discovered post.
 */
export type ProcessPostResult = "inserted" | "duplicate" | "failed";
