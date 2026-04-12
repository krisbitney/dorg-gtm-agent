import { test, expect, describe } from "bun:test";
import { mastra } from "../../src/mastra";

describe("Mastra Instance Composition", () => {
  test("GTM workflows are registered correctly", () => {
    const leadScoreWorkflow = mastra.getWorkflow("leadScoreWorkflow");
    expect(leadScoreWorkflow).toBeDefined();
    expect(leadScoreWorkflow.id).toBe("lead-score-workflow");

    const leadAnalysisWorkflow = mastra.getWorkflow("leadAnalysisWorkflow");
    expect(leadAnalysisWorkflow).toBeDefined();
    expect(leadAnalysisWorkflow.id).toBe("lead-analysis-workflow");
  });

  test("GTM agents are registered correctly", () => {
    const leadScoreAgent = mastra.getAgent("leadScoreAgent");
    expect(leadScoreAgent).toBeDefined();
    expect(leadScoreAgent.id).toBe("lead-score-agent");

    const leadAnalysisAgent = mastra.getAgent("leadAnalysisAgent");
    expect(leadAnalysisAgent).toBeDefined();
    expect(leadAnalysisAgent.id).toBe("lead-analysis-agent");
  });

  test("GTM scorers are registered correctly", () => {
    const scoreScorer = mastra.getScorer("leadScoreAccuracyScorer");
    expect(scoreScorer).toBeDefined();
    expect(scoreScorer.id).toBe("lead-score-accuracy");

    const analysisScorer = mastra.getScorer("leadAnalysisCompletenessScorer");
    expect(analysisScorer).toBeDefined();
    expect(analysisScorer.id).toBe("lead-analysis-completeness");
  });
});
