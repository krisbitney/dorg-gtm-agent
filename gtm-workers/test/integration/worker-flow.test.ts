import { test, expect, describe, beforeEach } from "bun:test";
import { ProcessLeadJob } from "../../src/use-cases/process-lead-job.js";
import { LeadRepository } from "../../src/storage/repositories/lead-repository.js";
import { db } from "../../src/storage/database.js";
import { leads } from "../../src/storage/schema/posts-table.js";
import { LeadStatus } from "../../src/constants/lead-status.js";

class FakeGtmAiClient {
  async scorePost() {
    return { leadProbability: 0.9 };
  }
  async analyzePost() {
    return {
      isLead: true,
      whyFit: "Matches criteria",
      needs: "Help with web3",
      timing: "Soon",
      contactInfo: "Reddit DM"
    };
  }
}

class FakeDorgApiClient {
  async claimLead() {
    return { success: true, leadId: "dorg-lead-123" };
  }
  async surfaceLead() {
    return { success: true };
  }
}

describe("Worker Flow Integration", () => {
  const postRepository = new LeadRepository();
  const gtmAiClient = new FakeGtmAiClient();
  const dorgApiClient = new FakeDorgApiClient();
  const workerRunId = "test-worker-run";
  const processPostJob = new ProcessLeadJob(
    postRepository,
    gtmAiClient as any,
    dorgApiClient as any,
    workerRunId
  );

  beforeEach(async () => {
    await db.delete(leads);
  });

  test("should process a post from pending to completed", async () => {
    // 1. Setup a pending post
    const postId = Bun.randomUUIDv7();
    await postRepository.insert({
      id: postId,
      url: "https://reddit.com/r/test/1",
      platform: "reddit",
      post: {
        topic: "test",
        username: "user1",
        content: "I need help with my DAO",
        postedAt: new Date().toISOString(),
      },
      status: LeadStatus.PENDING
    });

    // 2. Execute processing
    await processPostJob.execute(postId);

    // 3. Verify results
    const post = await postRepository.findById(postId);
    expect(post?.status).toBe(LeadStatus.COMPLETED);
    expect(post?.dorgLeadId).toBe("dorg-lead-123");
    expect(post?.whyFit).toBe("Matches criteria");
    expect(Number(post?.leadProbability)).toBe(0.9);
  });

  test("should stop processing if lead probability is below threshold", async () => {
    const postId = Bun.randomUUIDv7();
    await postRepository.insert({
      id: postId,
      url: "https://reddit.com/r/test/2",
      platform: "reddit",
      post: {
        topic: "test",
        username: "user1",
        content: "Low probability content",
        postedAt: new Date().toISOString(),
      },
      status: LeadStatus.PENDING
    });

    // Mock low score
    const lowScoreAiClient = {
      scorePost: async () => ({ leadProbability: 0.1 }),
      analyzePost: async () => ({ isLead: false })
    };
    const job = new ProcessLeadJob(postRepository, lowScoreAiClient as any, dorgApiClient as any, workerRunId);

    await job.execute(postId);

    const post = await postRepository.findById(postId);
    expect(post?.status).toBe(LeadStatus.BELOW_THRESHOLD);
    expect(post?.dorgLeadId).toBeNull();
  });
});
