import type { PendingPostRecord, QueuePayload, CrawlStatus } from "../domain/post.js";

/**
 * Interface for checking if a URL has already been processed.
 * This is used for cross-run deduplication.
 */
export interface ProcessedUrlStore {
  /**
   * Checks if the URL has already been processed.
   * @param url The canonical URL to check.
   */
  has(url: string): Promise<boolean>;

  /**
   * Marks the URL as permanently processed.
   * @param url The canonical URL to mark.
   */
  mark(url: string): Promise<void>;

  /**
   * Acquires a temporary claim/lock on a URL to reduce cross-run races.
   * @param url The canonical URL to claim.
   * @returns True if the claim was successful, false otherwise.
   */
  claim(url: string): Promise<boolean>;

  /**
   * Releases a temporary claim/lock on a URL.
   * @param url The canonical URL to release.
   */
  release(url: string): Promise<void>;
}

/**
 * Interface for persisting post records.
 */
export interface PostRepository {
  /**
   * Inserts a pending post record into the database.
   * @param record The post record to insert.
   */
  insert(record: PendingPostRecord): Promise<void>;

  /**
   * Updates the status of a post record.
   * @param id The ID of the post record.
   * @param status The new status.
   * @param errorMessage Optional error message.
   */
  updateStatus(id: string, status: CrawlStatus, errorMessage?: string): Promise<void>;
}

/**
 * Interface for publishing lead payloads to a queue.
 */
export interface LeadQueuePublisher {
  /**
   * Publishes a lead payload to the queue.
   * @param payload The payload to publish.
   */
  publish(payload: QueuePayload): Promise<void>;
}

/**
 * Interface for generating IDs.
 */
export interface IdGenerator {
  /**
   * Generates a unique ID (UUIDv7).
   */
  generate(): string;
}

/**
 * Interface for getting the current time.
 */
export interface Clock {
  /**
   * Returns the current Date and time.
   */
  now(): Date;
}
