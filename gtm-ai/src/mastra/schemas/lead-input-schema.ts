import { z } from "zod";

/**
 * Schema for potential lead.
 */
export const LeadInputSchema = z.object({
  leadId: z.uuid(),
  site: z.string(),
  url: z.url(),
  content: z.record(z.string(), z.unknown()),
});

export type CrawlerPostInput = z.infer<typeof LeadInputSchema>;
