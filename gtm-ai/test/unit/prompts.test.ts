import { test, expect, describe } from "bun:test";
import { formatCrawlerPostForLLM, MAX_CONTENT_LENGTH } from "../../src/mastra/prompts/format-crawler-post-for-llm";
import { buildLeadScorePrompt } from "../../src/mastra/prompts/build-lead-score-prompt";
import { buildLeadAnalysisPrompt } from "../../src/mastra/prompts/build-lead-analysis-prompt";
import { CrawlerPostInput } from "../../src/mastra/schemas/crawler-post-input-schema";

describe("Prompt Helpers", () => {
  const validPost: CrawlerPostInput = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    platform: "reddit",
    topic: "web3",
    url: "https://reddit.com/r/web3/comments/123",
    username: "user123",
    content: "Need help with a smart contract audit",
    ageText: "2 hours ago",
    likes: 10,
    nComments: 5,
    capturedAt: "2024-04-12T12:00:00Z",
  };

  describe("formatCrawlerPostForLLM", () => {
    test("stable section ordering and content inclusion", () => {
      const formatted = formatCrawlerPostForLLM(validPost);
      expect(formatted).toContain("Post ID: 550e8400-e29b-41d4-a716-446655440000");
      expect(formatted).toContain("Platform: reddit");
      expect(formatted).toContain("Content:\nNeed help with a smart contract audit");
    });

    test("missing nullable fields produce explicit placeholders", () => {
      const minimalPost: CrawlerPostInput = {
        ...validPost,
        username: null,
        ageText: null,
        likes: null,
        nComments: null,
      };
      const formatted = formatCrawlerPostForLLM(minimalPost);
      expect(formatted).toContain("Username: unknown");
      expect(formatted).toContain("Age: unknown");
      expect(formatted).toContain("Likes: 0");
      expect(formatted).toContain("Comments: 0");
    });

    test("long content truncates at the configured constant", () => {
      const longContent = "a".repeat(MAX_CONTENT_LENGTH + 100);
      const postWithLongContent = { ...validPost, content: longContent };
      const formatted = formatCrawlerPostForLLM(postWithLongContent);
      expect(formatted).toContain("[TRUNCATED]");
      expect(formatted.length).toBeLessThan(longContent.length + 500); // Allow some overhead for headers
      expect(formatted).toContain("a".repeat(MAX_CONTENT_LENGTH));
    });
  });

  describe("buildLeadScorePrompt", () => {
    test("prompt includes dOrg-fit criteria", () => {
      const prompt = buildLeadScorePrompt();
      expect(prompt).toContain("dOrg");
      expect(prompt).toContain("leadProbability");
      expect(prompt).toContain("Smart contract development");
    });
  });

  describe("buildLeadAnalysisPrompt", () => {
    test("prompt includes extraction instructions and anti-hallucination rules", () => {
      const prompt = buildLeadAnalysisPrompt();
      expect(prompt).toContain("isLead");
      expect(prompt).toContain("whyFit");
      expect(prompt).toContain("needs");
      expect(prompt).toContain("Anti-Hallucination Rules");
      expect(prompt).toContain("null");
    });
  });
});
