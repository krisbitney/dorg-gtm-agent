import { test, expect, describe } from "bun:test";
import { CrawlerPostInputSchema } from "../../src/mastra/schemas/crawler-post-input-schema";
import { LeadScoreResultSchema } from "../../src/mastra/schemas/lead-score-result-schema";
import { LeadAnalysisResultSchema } from "../../src/mastra/schemas/lead-analysis-result-schema";
import { LeadAnalysisRawResultSchema } from "../../src/mastra/schemas/lead-analysis-raw-result-schema";

describe("Schemas", () => {
  describe("CrawlerPostInputSchema", () => {
    const validPayload = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      platform: "reddit",
      topic: "web3",
      url: "https://reddit.com/r/web3/comments/123",
      username: "user123",
      content: "Need help with a smart contract",
      ageText: "2 hours ago",
      likes: 10,
      nComments: 5,
      capturedAt: new Date().toISOString(),
    };

    test("valid crawler payload parses successfully", () => {
      const result = CrawlerPostInputSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    test("invalid payload fails (missing id)", () => {
      const invalidPayload = { ...validPayload, id: undefined };
      const result = CrawlerPostInputSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    test("invalid platform fails", () => {
      const invalidPayload = { ...validPayload, platform: "twitter" };
      const result = CrawlerPostInputSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    test("invalid date format fails", () => {
      const invalidPayload = { ...validPayload, capturedAt: "not-a-date" };
      const result = CrawlerPostInputSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("LeadScoreResultSchema", () => {
    test("valid probability (0.5) parses successfully", () => {
      const result = LeadScoreResultSchema.safeParse({ leadProbability: 0.5 });
      expect(result.success).toBe(true);
    });

    test("valid probability (0) parses successfully", () => {
      const result = LeadScoreResultSchema.safeParse({ leadProbability: 0 });
      expect(result.success).toBe(true);
    });

    test("valid probability (1) parses successfully", () => {
      const result = LeadScoreResultSchema.safeParse({ leadProbability: 1 });
      expect(result.success).toBe(true);
    });

    test("probability < 0 fails", () => {
      const result = LeadScoreResultSchema.safeParse({ leadProbability: -0.1 });
      expect(result.success).toBe(false);
    });

    test("probability > 1 fails", () => {
      const result = LeadScoreResultSchema.safeParse({ leadProbability: 1.1 });
      expect(result.success).toBe(false);
    });
  });

  describe("LeadAnalysisResultSchema", () => {
    test("valid non-lead parses successfully", () => {
      const result = LeadAnalysisResultSchema.safeParse({ isLead: false });
      expect(result.success).toBe(true);
    });

    test("valid lead parses successfully", () => {
      const result = LeadAnalysisResultSchema.safeParse({
        isLead: true,
        whyFit: "Strong project background",
        needs: "Audit and security analysis",
        timing: "Next month",
        contactInfo: "Discord: user#1234",
      });
      expect(result.success).toBe(true);
    });

    test("non-lead result does not allow whyFit", () => {
      const result = LeadAnalysisResultSchema.safeParse({
        isLead: false,
        whyFit: "should not be here",
      });
      expect(result.success).toBe(false);
    });

    test("lead result requires whyFit and needs", () => {
      const result = LeadAnalysisResultSchema.safeParse({
        isLead: true,
        whyFit: "Strong background",
        // missing needs
      });
      expect(result.success).toBe(false);
    });
  });

  describe("LeadAnalysisRawResultSchema", () => {
    test("valid raw non-lead result parses", () => {
      const result = LeadAnalysisRawResultSchema.safeParse({
        isLead: false,
        whyFit: null,
        needs: null,
        timing: null,
        contactInfo: null,
      });
      expect(result.success).toBe(true);
    });

    test("valid raw lead result parses", () => {
      const result = LeadAnalysisRawResultSchema.safeParse({
        isLead: true,
        whyFit: "Fits because X",
        needs: "Needs Y",
        timing: "Soon",
        contactInfo: "email@example.com",
      });
      expect(result.success).toBe(true);
    });
  });
});
