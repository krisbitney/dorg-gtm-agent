import { test, expect, describe } from "bun:test";
import { buildSurfaceBrief } from "../../src/worker/build-surface-brief.js";

describe("buildSurfaceBrief", () => {
  test("should build a complete brief", () => {
    const post = {
      platform: "reddit",
      url: "https://reddit.com/r/web3/123",
      topic: "web3",
      username: "user1",
      whyFit: "They need smart contract help.",
      needs: "Smart contract developer.",
      timing: "Immediately",
      contactInfo: "DM on reddit",
    };

    const brief = buildSurfaceBrief(post as any);
    
    expect(brief).toContain("Source: reddit (https://reddit.com/r/web3/123)");
    expect(brief).toContain("Why it's a fit:\nThey need smart contract help.");
    expect(brief).toContain("Needs:\nSmart contract developer.");
    expect(brief).toContain("Timing: Immediately");
    expect(brief).toContain("Contact: DM on reddit");
  });

  test("should handle missing optional fields", () => {
    const post = {
      platform: "reddit",
      url: "https://reddit.com/r/web3/123",
      topic: "web3",
      whyFit: "Fit",
      needs: "Needs",
    };

    const brief = buildSurfaceBrief(post as any);
    
    expect(brief).toContain("Source: reddit (https://reddit.com/r/web3/123)");
    expect(brief).not.toContain("User: user1");
    expect(brief).not.toContain("Timing:");
    expect(brief).not.toContain("Contact:");
  });
});
