/**
 * Enumeration of all possible states for an Apify crawl run.
 */
export const CrawlRunStatus = {
  STARTED: "started",
  WEBHOOK_RECEIVED: "webhook_received",
  IMPORTING: "importing",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type CrawlRunStatusType = typeof CrawlRunStatus[keyof typeof CrawlRunStatus];
