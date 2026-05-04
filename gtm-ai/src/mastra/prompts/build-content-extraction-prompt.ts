import type { ScrapedLead } from "../schemas/search-and-filter-schema";

const MAX_CONTENT_LENGTH = 200_000;

/**
 * Builds the prompt for extracting relevant lead content from a single scraped page.
 * Strips filler, ads, navigation, and unrelated sections — keeping only
 * the content that matters for evaluating whether the page is a lead.
 */
export const buildContentExtractionPrompt = (params: {
  targetDescription: string;
  lead: ScrapedLead;
}): string => {
  return `
You are extracting relevant content from a scraped web page to evaluate a potential lead for the following consultancy:

### Target Consultancy
${params.targetDescription}

### Scraped Page
URL: ${params.lead.url}
---RAW CONTENT (truncated to a maximum of ${MAX_CONTENT_LENGTH} characters)---
${params.lead.content.slice(0, MAX_CONTENT_LENGTH)}
---END---

### Instructions
1. Extract only the content relevant to the potential lead.
  - For example, if the page is a social media post (e.g., Reddit, LinkedIn), keep the original post, its title, its author, and the date posted. Drop comments, sidebars, ads, and unrelated replies.
  - Always preserve any contact information (including social media usernames), relevant dates, budget mentions, timelines, and technical requirements.
2. Return a JSON object with a single "leads" array containing { url, content } with the extracted relevant content.
3. If the page contains no lead-relevant content after extraction, return an empty array.
`.trim();
};
