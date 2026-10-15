import { z } from "zod";

/**
 * Input schema for the search term generation workflow.
 */
export const SearchTermGenerationInputSchema = z.object({
  /** Number of search terms to generate */
  numberOfSearchTerms: z.number().int().positive(),
  /** Target site to search on (e.g. "https://reddit.com", "https://linkedin.com") */
  sourceUrl: z.string(),
  /**
   * Description of the target consultancy and what constitutes a good lead.
   * This is used to tailor the generated search queries.
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
