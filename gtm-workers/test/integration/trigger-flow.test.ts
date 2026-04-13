import { test, expect, describe, beforeEach } from "bun:test";
import { StartApifyCrawlRun } from "../../src/use-cases/start-apify-crawl-run.js";
import { CrawlRunRepository } from "../../src/storage/repositories/crawl-run-repository.js";
import { db } from "../../src/storage/database.js";
import { crawlRuns } from "../../src/storage/schema/crawl-runs-table.js";
import { CrawlRunStatus } from "../../src/constants/crawl-run-status.js";

class FakeApifyClient {
  async startActor() {
    return {
      id: "fake-run-id",
      actorId: "fake-actor-id",
      status: "RUNNING",
      defaultDatasetId: "fake-dataset-id",
    };
  }
  async getRun() { return {} as any; }
  async getDatasetItems() { return []; }
}

describe("Trigger Flow Integration", () => {
  const crawlRunRepository = new CrawlRunRepository();
  const fakeApifyClient = new FakeApifyClient();
  const startCrawlRun = new StartApifyCrawlRun(fakeApifyClient as any, crawlRunRepository);

  beforeEach(async () => {
    await db.delete(crawlRuns);
  });

  test("should start a crawl run and record it", async () => {
    const result = await startCrawlRun.execute({ platform: "reddit", source: "scheduler" });
    
    expect(result.apifyRunId).toBe("fake-run-id");
    expect(result.status).toBe("RUNNING");

    const run = await crawlRunRepository.findByApifyRunId("fake-run-id");
    expect(run).toBeDefined();
    expect(run?.status).toBe(CrawlRunStatus.STARTED);
    expect(run?.source).toBe("scheduler");
  });
});
