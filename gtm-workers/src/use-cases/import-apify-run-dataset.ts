import type { ApifyCrawlerClientInterface } from "../clients/apify-crawler-client.js";
import { CrawlRunRepository } from "../storage/repositories/crawl-run-repository.js";
import { LeadRepository } from "../storage/repositories/lead-repository.js";
import type { ProcessedUrlStoreInterface } from "../storage/processed-url-store.js";
import type { LeadQueueInterface } from "../storage/lead-queue.js";
import type { ApifyRunWebhook } from "../schemas/apify-run-webhook-schema.js";
import { CrawlRunStatus } from "../constants/crawl-run-status.js";
import {type Platform, platformSchemas, postTransforms, postUrlGetters} from "../schemas/platform.ts";

/**
 * Use case to import the dataset from a completed Apify run.
 */
export class ImportApifyRunDataset {
  constructor(
    private readonly apifyClient: ApifyCrawlerClientInterface,
    private readonly crawlRunRepository: CrawlRunRepository,
    private readonly postRepository: LeadRepository,
    private readonly processedUrlStore: ProcessedUrlStoreInterface,
    private readonly leadQueue: LeadQueueInterface
  ) {}

  /**
   * Orchestrates fetching and importing dataset items into the database and queue.
   */
  async execute(notification: ApifyRunWebhook, platform: Platform): Promise<void> {
    const { apifyRunId, actorId, status, defaultDatasetId } = notification;

    const platformSchema = platformSchemas[platform];
    const postUrlGetter = postUrlGetters[platform];
    const postTransform = postTransforms[platform];
    if (!platformSchema || !postUrlGetter || !postTransform) {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    // 1. Upsert or find the run record
    let run = await this.crawlRunRepository.findByApifyRunId(apifyRunId);
    if (!run) {
      await this.crawlRunRepository.upsertStartedRun({
        apifyRunId,
        actorId,
        source: "webhook",
      });
      run = await this.crawlRunRepository.findByApifyRunId(apifyRunId);
    }

    // 2. Skip if already completed
    if (run?.status === CrawlRunStatus.COMPLETED) {
      console.log(`Crawl run ${apifyRunId} already completed, skipping import.`);
      return;
    }

    // 3. Handle failed runs
    if (status !== "SUCCEEDED") {
      await this.crawlRunRepository.markFailed(apifyRunId, `Actor run ended with status: ${status}`);
      return;
    }

    // 4. Resolve dataset ID
    let datasetId = defaultDatasetId;
    if (!datasetId) {
      const runDetails = await this.apifyClient.getRun(apifyRunId);
      datasetId = runDetails.defaultDatasetId;
    }

    if (!datasetId) {
      throw new Error(`Could not resolve dataset ID for run: ${apifyRunId}`);
    }

    console.log(
      `[apify-import] Starting dataset import: runId=${apifyRunId} datasetId=${datasetId} platform=${platform}`
    );

    // 5. Start importing
    await this.crawlRunRepository.markImporting(apifyRunId, datasetId);

    const counters = {
      itemsRead: 0,
      itemsImported: 0,
      duplicatesSkipped: 0,
      invalidItems: 0,
      failedItems: 0,
    };

    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      const items = await this.apifyClient.getDatasetItems(datasetId, { limit, offset });
      if (items.length === 0) {
        hasMore = false;
        break;
      }

      for (const rawItem of items) {
        counters.itemsRead++;

        // a1. Validate raw post data
        const validationResult = platformSchema.safeParse(rawItem);
        if (!validationResult.success) {
          console.warn(`Invalid item in dataset ${datasetId} for platform ${platform}:`, validationResult.error.format());
          counters.invalidItems++;
          continue;
        }
        const validatedPost = validationResult.data;

        // a2. Get and validate post url
        const postUrl = postUrlGetter(validatedPost);
        if (!postUrl) {
          console.warn(`Missing URL in item for platform ${platform}:`, validatedPost);
          counters.invalidItems++;
          continue;
        }

        // a3. Transform post data
        const transformedPost = postTransform(validatedPost, postUrl);

        // b. Deduplicate by URL
        const isDuplicate = await this.processedUrlStore.has(postUrl);
        if (isDuplicate) {
          counters.duplicatesSkipped++;
          continue;
        }

        // c. Optional temporary claim to prevent concurrent double-imports
        const hasClaim = await this.processedUrlStore.claim(postUrl);
        if (!hasClaim) {
          counters.duplicatesSkipped++;
          continue;
        }

        try {
          // d. Generate ID and insert into Postgres
          const postId = Bun.randomUUIDv7();
          await this.postRepository.insert({
            id: postId,
            url: postUrl,
            platform,
            post: transformedPost,
            apifyRunId,
            apifyDatasetId: datasetId,
          });

          // e. Publish to Redis queue
          await this.leadQueue.enqueue(JSON.stringify({ id: postId, platform }));

          // f. Permanently mark as processed
          await this.processedUrlStore.mark(postUrl);
          counters.itemsImported++;
        } catch (error) {
          console.error(`Failed to import post ${postUrl}:`, error);
          counters.failedItems++;
          // We don't mark as processed so it can be retried
        } finally {
          await this.processedUrlStore.release(postUrl);
        }
      }

      offset += items.length;
      if (items.length < limit) {
        hasMore = false;
      }
    }

    // 6. Complete the run
    await this.crawlRunRepository.markCompleted(apifyRunId, counters);
    console.log(
      `[apify-import] Import completed: runId=${apifyRunId} datasetId=${datasetId} read=${counters.itemsRead} imported=${counters.itemsImported} duplicates=${counters.duplicatesSkipped} invalid=${counters.invalidItems} failed=${counters.failedItems}`
    );
  }
}
