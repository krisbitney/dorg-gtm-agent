import type { SearchTermGenerationInput } from "../schemas/search-term-generation-schema";

/**
 * Builds a prompt for the search term generation agent.
 * The prompt instructs the model to generate effective search queries
 * tailored to the target consultancy, site, and time range.
 */
export const buildSearchTermPrompt = (input: SearchTermGenerationInput): string => {
  return `
You are an expert B2B lead generation specialist. Generate highly effective, natural-language search queries tailored for the platform: ${input.sourceUrl}.

### Target Consultancy Description
${input.targetDescription}

### Search Strategy & Buyer Psychology
To find actionable leads, capture the exact phrasing a decision-maker uses just before or exactly when they realize they need external help, OR when they announce capital raises that signal an imminent need to scale development. Combine **Buying Intent / Funding Signals** with the consultancy's **Service/Tech Keywords**.

Diversify your queries across these 6 intent angles:
1. **Vendor Sourcing:** "recommend a [tech] agency", "looking for a [tech] dev shop", "need a consultancy to build"
2. **Team Expansion / Staff Augmentation:** "outsource our [tech] development", "hire a team of [tech] contractors", "bring on an external [tech] team"
3. **Pain Points / Rescue Missions:** "need help auditing our [tech]", "struggling to scale our [tech] architecture", "[tech] migration experts needed"
4. **Advice Seeking (High Conversion):** "how much does a [tech] agency cost", "what to look for in a [tech] dev shop", "freelancer vs agency for [tech]"
5. **Budget / RFPs:** "grant proposal for [tech]", "RFP [tech] development", "budget for [tech] agency"
6. **Recent Funding / Scaling (Capital Deployment):** "announcing our funding [tech]", "just raised seed round [tech]", "closed Series A looking to scale", "backed by [VC] building [tech]"

### Platform Context: ${input.sourceUrl}
Adapt your queries to how users search and post on this specific platform:
- If a forum/community (Reddit, Discord): Use first-person, advice-seeking phrasing ("we need to hire", "looking for recommendations").
- If a professional network (LinkedIn): Use direct, sourcing-focused phrasing ("seeking vendor", "RFP") or PR announcement styles ("thrilled to announce our seed round").
- If a microblog (X/Twitter): Keep it punchy ("looking for a [tech] agency", "just raised $10M to build [tech]").

### ⚠️ CRITICAL RULES FOR QUERY QUALITY ⚠️
- **The 3-to-6 Word Sweet Spot:** Optimize for native search engine keyword matching.
  - ❌ *Too Broad (Millions of junk results):* "AI development"
  - ❌ *Too Specific (Zero results):* "looking for an agency to build a custom rust substrate pallet"
  - ✅ *Just Right (High intent, high match rate):* "recommend a web3 dev shop" OR "just raised series A scaling"
- **Pronoun Variation:** Mix starting phrases (e.g., "I need", "we need", "looking for", "seeking", "we raised").
- **No W-2/FTE Jobs:** Do NOT generate queries for single-employee roles. 
- **Unique Angles:** Do not output repetitive queries; ensure a diverse mix of the 6 intent angles above.

### Output Format
Generate EXACTLY ${input.numberOfSearchTerms} queries.
Return ONLY a valid JSON object containing a single key "queries" mapping to an array of exactly ${input.numberOfSearchTerms} strings. Do not include markdown formatting or extra text outside the JSON.
`.trim();
};