import { eq } from "drizzle-orm";
import { db } from "../database.js";
import { crawlRuns, type CrawlRun, type NewCrawlRun } from "../schema/crawl-runs-table.js";
import { CrawlRunStatus } from "../../constants/crawl-run-status.js";

/**
 * Repository for managing crawl run records in the database.
 */
export class CrawlRunRepository {
  /**
   * Creates or upserts a crawl run record when it starts.
   */
  async upsertStartedRun(run: NewCrawlRun): Promise<void> {
    await db.insert(crawlRuns)
      .values({
        ...run,
        status: CrawlRunStatus.STARTED,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: crawlRuns.apifyRunId,
        set: {
          status: CrawlRunStatus.STARTED,
          actorId: run.actorId,
          source: run.source,
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Marks a crawl run as having received a webhook notification.
   */
  async markWebhookReceived(apifyRunId: string): Promise<void> {
    await db.update(crawlRuns)
      .set({
        status: CrawlRunStatus.WEBHOOK_RECEIVED,
        webhookReceivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(crawlRuns.apifyRunId, apifyRunId));
  }

  /**
   * Marks a crawl run as starting the dataset import process.
   */
  async markImporting(apifyRunId: string, defaultDatasetId?: string): Promise<void> {
    await db.update(crawlRuns)
      .set({
        status: CrawlRunStatus.IMPORTING,
        defaultDatasetId: defaultDatasetId ?? undefined,
        importStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(crawlRuns.apifyRunId, apifyRunId));
  }

  /**
   * Marks a crawl run as successfully completed with final counters.
   */
  async markCompleted(
    apifyRunId: string,
    counters: {
      itemsRead: number;
      itemsImported: number;
      duplicatesSkipped: number;
      invalidItems: number;
      failedItems: number;
    }
  ): Promise<void> {
    await db.update(crawlRuns)
      .set({
        ...counters,
        status: CrawlRunStatus.COMPLETED,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(crawlRuns.apifyRunId, apifyRunId));
  }

  /**
   * Marks a crawl run as failed with an error message.
   */
  async markFailed(apifyRunId: string, errorMessage: string): Promise<void> {
    await db.update(crawlRuns)
      .set({
        status: CrawlRunStatus.FAILED,
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(crawlRuns.apifyRunId, apifyRunId));
  }

  /**
   * Fetches a crawl run record by Apify run ID.
   */
  async findByApifyRunId(apifyRunId: string): Promise<CrawlRun | undefined> {
    const results = await db.select().from(crawlRuns).where(eq(crawlRuns.apifyRunId, apifyRunId)).limit(1);
    return results[0];
  }
}
