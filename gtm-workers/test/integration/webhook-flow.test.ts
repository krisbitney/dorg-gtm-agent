import { test, expect, describe, beforeEach } from "bun:test";
import { ImportApifyRunDataset } from "../../src/use-cases/import-apify-run-dataset.js";
import { CrawlRunRepository } from "../../src/storage/repositories/crawl-run-repository.js";
import { LeadRepository } from "../../src/storage/repositories/lead-repository.js";
import { RedisLeadQueue } from "../../src/storage/lead-queue.js";
import { RedisProcessedUrlStore } from "../../src/storage/processed-url-store.js";
import { db } from "../../src/storage/database.js";
import { crawlRuns } from "../../src/storage/schema/crawl-runs-table.js";
import { leads } from "../../src/storage/schema/posts-table.js";
import { CrawlRunStatus } from "../../src/constants/crawl-run-status.js";
import { appEnv } from "../../src/config/app-env.js";

class FakeApifyClient {
  async startActor() { return {} as any; }
  async getRun() { 
    return {
      id: "run-id",
      status: "SUCCEEDED",
      defaultDatasetId: "dataset-id"
    };
  }
  async getDatasetItems() {
    return [
      {
        url: "https://reddit.com/r/test/1",
        username: "user1",
        content: "content1",
        postedAt: 1711022400000,
        nLikes: 10,
        nComments: 5,
        topic: "test"
      }
    ];
  }
}

describe("Webhook Flow Integration", () => {
  const crawlRunRepository = new CrawlRunRepository();
  const postRepository = new LeadRepository();
  const leadQueue = new RedisLeadQueue();
  const processedUrlStore = new RedisProcessedUrlStore();
  const fakeApifyClient = new FakeApifyClient();
  const importDataset = new ImportApifyRunDataset(
    fakeApifyClient as any,
    crawlRunRepository,
    postRepository,
    processedUrlStore,
    leadQueue
  );

  beforeEach(async () => {
    await db.delete(leads);
    await db.delete(crawlRuns);
    await Bun.redis.del(appEnv.PROCESSED_URLS_KEY);
    await Bun.redis.del(appEnv.QUEUE_NAME);
  });

  test("should import dataset and enqueue posts", async () => {
    // 1. Setup a started run
    await crawlRunRepository.upsertStartedRun({
      apifyRunId: "run-id",
      actorId: "actor-id",
      source: "manual"
    });

    // 2. Execute import
    await importDataset.execute({
      eventType: "ACTOR.RUN.SUCCEEDED",
      actorId: "actor-id",
      apifyRunId: "run-id",
      status: "SUCCEEDED"
    }, "reddit");

    // 3. Verify results
    const run = await crawlRunRepository.findByApifyRunId("run-id");
    expect(run?.status).toBe(CrawlRunStatus.COMPLETED);
    expect(run?.itemsImported).toBe(1);

    const allPosts = await db.select().from(leads);
    expect(allPosts.length).toBe(1);
    expect(allPosts[0]?.url).toBe("https://reddit.com/r/test/1");

    const queuedPayload = await leadQueue.reserveNext();
    expect(queuedPayload).toBeDefined();
    expect(JSON.parse(queuedPayload!).id).toBe(allPosts[0]?.id);
  });
});
