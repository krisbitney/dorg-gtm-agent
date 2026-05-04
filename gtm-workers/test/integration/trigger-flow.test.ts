import { test, expect, describe, beforeEach } from "bun:test";
import { StartApifyCrawlRun } from "../../src/jobs/start-apify-crawl-run.js";
import { CrawlRunRepository } from "../../src/storage/repositories/crawl-run-repository.js";
import { db } from "../../src/storage/database.js";
import { crawlRuns } from "../../src/storage/schema/crawl-runs-table.js";
import { CrawlRunStatus } from "../../src/constants/crawl-run-status.js";

class FakeApifyClient {
  async startActor(options: any) {
    return {
      id: "fake-run-id",
      actorId: "fake-actor-id",
      status: "RUNNING",
      defaultDatasetId: "fake-dataset-id",
    };
  }
  async getRun(runId: string) { return {} as any; }
  async getDatasetItems(datasetId: string) { return []; }
}

describe("Trigger Flow Integration", () => {
  const crawlRunRepository = new CrawlRunRepository();
  const fakeApifyClient = new FakeApifyClient();
  const startCrawlRun = new StartApifyCrawlRun(fakeApifyClient as any, crawlRunRepository);

  beforeEach(async () => {
    await db.delete(crawlRuns);
  });

  test("should start a crawl run and record it", async () => {
    const result = await startCrawlRun.execute({ site: "reddit", actorId: "fake-actor-id", source: "scheduler" });
    
    expect(result.apifyRunId).toBe("fake-run-id");
    expect(result.status).toBe("RUNNING");
    expect(result.actorId).toBe("fake-actor-id");

    const run = await crawlRunRepository.findByApifyRunId("fake-run-id");
    expect(run).toBeDefined();
    expect(run?.status).toBe(CrawlRunStatus.STARTED);
    expect(run?.source).toBe("scheduler");
    expect(run?.actorId).toBe("fake-actor-id");
  });
});
