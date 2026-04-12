import { test, expect, describe } from "bun:test";
import { normalizeLeadScoreResult } from "../../src/mastra/workflows/normalize-lead-score-result";
import { normalizeLeadAnalysisResult } from "../../src/mastra/workflows/normalize-lead-analysis-result";

describe("Workflow Normalizers", () => {
  describe("normalizeLeadScoreResult", () => {
    test("clamps values below 0 to 0", () => {
      const result = normalizeLeadScoreResult({ leadProbability: -0.5 });
      expect(result.leadProbability).toBe(0);
    });

    test("clamps values above 1 to 1", () => {
      const result = normalizeLeadScoreResult({ leadProbability: 1.5 });
      expect(result.leadProbability).toBe(1);
    });

    test("preserves valid numbers and rounds to 3 decimals", () => {
      const result = normalizeLeadScoreResult({ leadProbability: 0.123456 });
      expect(result.leadProbability).toBe(0.123);
    });
  });

  describe("normalizeLeadAnalysisResult", () => {
    test("non-lead returns exact minimal object", () => {
      const result = normalizeLeadAnalysisResult({
        isLead: false,
        whyFit: null,
        needs: null,
        timing: null,
        contactInfo: null,
      });
      expect(result).toEqual({ isLead: false });
    });

    test("lead result requires whyFit and needs", () => {
      expect(() => {
        normalizeLeadAnalysisResult({
          isLead: true,
          whyFit: null,
          needs: "something",
          timing: null,
          contactInfo: null,
        });
      }).toThrow();
    });

    test("lead result trims and handles blank optional fields", () => {
      const result = normalizeLeadAnalysisResult({
        isLead: true,
        whyFit: "  Fits because of X  ",
        needs: "  Needs Y  ",
        timing: "",
        contactInfo: "   ",
      });
      expect(result).toEqual({
        isLead: true,
        whyFit: "Fits because of X",
        needs: "Needs Y",
        timing: null,
        contactInfo: null,
      });
    });
  });
});
