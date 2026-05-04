import { test, expect, describe, beforeEach } from "bun:test";
import { LeadRepository } from "../../src/storage/repositories/lead-repository.js";
import { CrawlRunRepository } from "../../src/storage/repositories/crawl-run-repository.js";
import { LeadStatus } from "../../src/constants/lead-status.js";
import { CrawlRunStatus } from "../../src/constants/crawl-run-status.js";
import { db } from "../../src/storage/database.js";
import { leads } from "../../src/storage/schema/posts-table.js";
import { crawlRuns } from "../../src/storage/schema/crawl-runs-table.js";

describe("Repositories", () => {
  const postRepository = new LeadRepository();
  const crawlRunRepository = new CrawlRunRepository();

  beforeEach(async () => {
    // Clear the tables before each test
    await db.delete(leads);
    await db.delete(crawlRuns);
  });

  describe("PostRepository", () => {
    const postId = Bun.randomUUIDv7();

    test("should insert and find a post", async () => {
      await postRepository.insert({
        id: postId,
        url: `https://reddit.com/r/test/${Bun.randomUUIDv7()}`,
        platform: "reddit",
        post: {
          topic: "test",
          username: "testuser",
          content: "test content",
          postedAt: new Date().toISOString(),
        },
        status: LeadStatus.PENDING,
      });

      const post = await postRepository.findById(postId);
      expect(post).toBeDefined();
      expect(post?.id).toBe(postId);
      expect(post?.status).toBe(LeadStatus.PENDING);
    });

    test("should update post status", async () => {
      const id = Bun.randomUUIDv7();
      await postRepository.insert({
        id,
        url: `https://reddit.com/r/test/${Bun.randomUUIDv7()}`,
        platform: "reddit",
        post: {
          topic: "test",
          username: "testuser",
          content: "test content",
          postedAt: new Date().toISOString(),
        },
        status: LeadStatus.PENDING,
      });

      await postRepository.updateStatus(id, LeadStatus.SCORING);
      const post = await postRepository.findById(id);
      expect(post?.status).toBe(LeadStatus.SCORING);
    });

    test("should save lead score", async () => {
      const id = Bun.randomUUIDv7();
      await postRepository.insert({
        id,
        url: `https://reddit.com/r/test/${Bun.randomUUIDv7()}`,
        platform: "reddit",
        post: {
          topic: "test",
          username: "testuser",
          content: "test content",
          postedAt: new Date().toISOString(),
        },
        status: LeadStatus.PENDING,
      });

      await postRepository.saveScore(id, 0.85, LeadStatus.ANALYZING);
      const post = await postRepository.findById(id);
      expect(Number(post?.leadProbability)).toBe(0.85);
      expect(post?.status).toBe(LeadStatus.ANALYZING);
    });
  });

  describe("CrawlRunRepository", () => {
    const runId = "test-run-123";

    test("should upsert a started run", async () => {
      await crawlRunRepository.upsertStartedRun({
        apifyRunId: runId,
        actorId: "test-actor",
        source: "manual",
      });

      const run = await crawlRunRepository.findByApifyRunId(runId);
      expect(run).toBeDefined();
      expect(run?.apifyRunId).toBe(runId);
      expect(run?.status).toBe(CrawlRunStatus.STARTED);
    });

    test("should mark run completed", async () => {
      await crawlRunRepository.upsertStartedRun({
        apifyRunId: runId,
        actorId: "test-actor",
        source: "manual",
      });

      await crawlRunRepository.markCompleted(runId, {
        itemsRead: 10,
        itemsImported: 8,
        duplicatesSkipped: 2,
        invalidItems: 0,
        failedItems: 0,
      });

      const run = await crawlRunRepository.findByApifyRunId(runId);
      expect(run?.status).toBe(CrawlRunStatus.COMPLETED);
      expect(run?.itemsRead).toBe(10);
    });
  });
});
