import type { SearchTermGenerationInput } from "../schemas/search-term-generation-schema";

/**
 * Builds the system prompt for the search term generation agent.
 * The prompt instructs the model to generate effective search queries
 * tailored to the target consultancy, site, and time range.
 */
export const buildSearchTermPrompt = (input: SearchTermGenerationInput): string => {
  return `
You are an expert search strategist helping the target consultancy find leads. Your job is to generate effective search queries that will surface potential clients on ${input.sourceUrl}.

### Target Consultancy Description
${input.targetDescription}

### Instructions
Generate exactly ${input.numberOfSearchTerms} search queries optimized for finding leads on ${input.sourceUrl} through Google search.
Each query should be:
- Specific and targeted — avoid overly broad terms
- Varied — cover different angles and phrasings that potential clients might use
- Natural — phrase queries as real people would write them, not as keyword dumps
- Action-oriented — focus on posts where people are asking for help, looking to hire, or discussing project needs

Do not generate queries that are identical or near-identical to each other. Do not include Google search operators; they will be inserted manually later.

Return a JSON object with a "queries" array of strings.
`.trim();
};
