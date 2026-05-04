import type { SearchResult } from "../interfaces/search-provider-interface";

/**
 * Builds the prompt for the search filter agent.
 * The agent evaluates search result titles and snippets to decide
 * which URLs are promising enough to scrape.
 */
export const buildSearchFilterPrompt = (params: {
  targetDescription: string;
  searchResults: SearchResult[];
}): string => {
  const resultsBlock = params.searchResults
    .map(
      (r, i) =>
        `[${i + 1}] Title: ${r.title}\n    URL: ${r.url}\n    Snippet: ${r.snippet}`,
    )
    .join("\n\n");

  return `
You are evaluating search results to find leads for the following consultancy:

### Target Consultancy
${params.targetDescription}

### Search Results
${resultsBlock}

### Instructions
1. Review each search result's title and snippet.
2. Identify which results could be leads for the consultancy based on the title and snippet alone.
3. Return a JSON object with a "promisingUrls" array containing { url } for each result that looks like a potential lead.
4. Skip generic forum threads, spam, job postings for in-house roles, and clearly irrelevant pages.
5. If none of the results look like leads, return an empty array.
`.trim();
};
