import { z } from "zod";

/**
 * Input schema for the search term generation workflow.
 * The site, startDateTime, and endDateTime are determined by input parameters,
 * not by the LLM. The LLM only generates the searchQuery strings.
 */
export const SearchTermGenerationInputSchema = z.object({
  /** Number of search terms to generate */
  numberOfSearchTerms: z.number().int().positive().default(5),
  /** Target site to search on (e.g. "https://reddit.com", "https://linkedin.com") */
  sourceUrl: z.string(),
  /**
   * Description of the target consultancy and what constitutes a good lead.
   * This is used to tailor the generated search queries.
   * Should be configurable for different kinds of consultancies.
   */
  targetDescription: z.string(),
});

export type SearchTermGenerationInput = z.infer<typeof SearchTermGenerationInputSchema>;

/**
 * Output schema for the search term generation workflow.
 */
export const SearchTermGenerationOutputSchema = z.object({
  queries: z.array(z.string()),
});

export type SearchTermGenerationOutput = z.infer<typeof SearchTermGenerationOutputSchema>;
