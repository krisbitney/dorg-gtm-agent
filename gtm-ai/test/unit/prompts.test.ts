import { test, expect, describe } from "bun:test";
import { buildLeadScorePrompt } from "../../src/mastra/prompts/build-lead-score-prompt";
import { buildLeadAnalysisPrompt } from "../../src/mastra/prompts/build-lead-analysis-prompt";

describe("Prompt Helpers", () => {

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
