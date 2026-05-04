import { z } from "zod";

/**
 * Schema for the search filter workflow state.
 * Stored in workflow state since it is unchanging throughout the workflow.
 */
export const SearchAndFilterStateSchema = z.object({
  searchQuery: z.string(),
  site: z.string(),
  startDateTime: z.string(),
  endDateTime: z.string(),
  pages: z.number().int().positive().default(1),
  targetDescription: z.string(),
});

export type SearchAndFilterState = z.infer<typeof SearchAndFilterStateSchema>;

/**
 * Output from the agent filter step — URLs that look promising based on
 * title and snippet alone.
 */
export const SearchFilterOutputSchema = z.object({
  promisingUrls: z.array(
    z.object({
      url: z.string(),
    }),
  ),
});

export type SearchFilterOutput = z.infer<typeof SearchFilterOutputSchema>;

/**
 * A single scraped lead result.
 */
export const ScrapedLeadSchema = z.object({
  url: z.string(),
  content: z.string(),
});

export type ScrapedLead = z.infer<typeof ScrapedLeadSchema>;

/**
 * Output schema for the search and filter workflow.
 */
export const SearchAndFilterOutputSchema = z.object({
  leads: z.array(ScrapedLeadSchema),
});

export type SearchAndFilterOutput = z.infer<typeof SearchAndFilterOutputSchema>;
