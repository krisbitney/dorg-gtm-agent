import { test, expect, describe } from "bun:test";
import { apifyRedditPostSchema } from "../../src/types/post-schemas/apify-reddit-post-schema.js";
import { apifyRunWebhookSchema } from "../../src/types/apify-run-webhook-schema.js";
import { queuePayloadSchema } from "../../src/types/queue-payload-schema.js";
import { triggerCrawlRequestSchema } from "../../src/types/trigger-crawl-request-schema.js";
import { triggerCrawlResponseSchema } from "../test-utils/trigger-crawl-response-schema.js";
import { deadLetterPayloadSchema } from "../test-utils/dead-letter-payload-schema.js";
import { dorgClaimResponseSchema } from "../test-utils/dorg-claim-response-schema.js";

describe("Schemas", () => {
  describe("apifyRedditPostSchema", () => {
    test("should validate a valid reddit post", () => {
      const validPost = {
        url: "https://reddit.com/r/web3/comments/123",
        username: "user1",
        content: "some content",
        postedAt: 1711022400000,
        nLikes: 10,
        nComments: 5,
        topic: "web3",
      };
      const result = apifyRedditPostSchema.safeParse(validPost);
      expect(result.success).toBe(true);
    });

    test("should reject an invalid url", () => {
      const invalidPost = {
        url: "not-a-url",
        username: "user1",
        content: "some content",
        postedAt: 1711022400000,
        nLikes: 10,
        nComments: 5,
        topic: "web3",
      };
      const result = apifyRedditPostSchema.safeParse(invalidPost);
      expect(result.success).toBe(false);
    });
  });

  describe("apifyRunWebhookSchema", () => {
    test("should validate a valid run succeeded webhook", () => {
      const validWebhook = {
        eventType: "ACTOR.RUN.SUCCEEDED",
        actorId: "actor1",
        apifyRunId: "run1",
        status: "SUCCEEDED",
        defaultDatasetId: "dataset1",
        finishedAt: "2024-03-21T12:00:00.000Z",
      };
      const result = apifyRunWebhookSchema.safeParse(validWebhook);
      expect(result.success).toBe(true);
    });
  });

  describe("queuePayloadSchema", () => {
    test("should validate a valid queue payload", () => {
      const validPayload = {
        id: "72175949-8c67-463d-82b4-53906263884d",
        platform: "reddit",
      };
      const result = queuePayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });
  });

  describe("triggerCrawlRequestSchema", () => {
    test("should validate a valid trigger request", () => {
      const validRequest = {
        platform: "reddit",
        source: "scheduler",
      };
      const result = triggerCrawlRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    test("should use default value for missing fields", () => {
      const result = triggerCrawlRequestSchema.parse({});
      expect(result?.platform).toBe("reddit");
      expect(result?.source).toBe("manual");
    });
  });

  describe("triggerCrawlResponseSchema", () => {
    test("should validate a valid trigger response", () => {
      const validResponse = {
        apifyRunId: "run1",
        actorId: "actor1",
        status: "RUNNING",
        webhookUrl: "https://example.com/webhook",
      };
      const result = triggerCrawlResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });
  });

  describe("deadLetterPayloadSchema", () => {
    test("should validate a valid DLQ payload", () => {
      const validDLQ = {
        id: "post1",
        platform: "reddit",
        stage: "processing",
        errorMessage: "error",
        failedAt: "2024-03-21T12:00:00.000Z",
        originalPayload: '{"id":"post1"}',
      };
      const result = deadLetterPayloadSchema.safeParse(validDLQ);
      expect(result.success).toBe(true);
    });
  });

  describe("dorgClaimResponseSchema", () => {
    test("should validate a valid claim response", () => {
      const validResponse = {
        lead_id: "lead1",
      };
      const result = dorgClaimResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });
  });
});
