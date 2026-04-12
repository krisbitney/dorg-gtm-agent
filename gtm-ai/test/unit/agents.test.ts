import { test, expect, describe } from "bun:test";
import { leadScoreAgent } from "../../src/mastra/agents/lead-score-agent";
import { leadAnalysisAgent } from "../../src/mastra/agents/lead-analysis-agent";

describe("Agent Configurations", () => {
  test("leadScoreAgent can be imported and has correct ID", () => {
    expect(leadScoreAgent).toBeDefined();
    expect(leadScoreAgent.id).toBe("lead-score-agent");
  });

  test("leadAnalysisAgent can be imported and has correct ID", () => {
    expect(leadAnalysisAgent).toBeDefined();
    expect(leadAnalysisAgent.id).toBe("lead-analysis-agent");
  });

  test("agents have instructions configured", async () => {
    const scoreInstructions = await leadScoreAgent.getInstructions();
    expect(scoreInstructions).toContain("dOrg");
    
    const analysisInstructions = await leadAnalysisAgent.getInstructions();
    expect(analysisInstructions).toContain("dOrg");
  });
});
