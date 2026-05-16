import { z } from "zod";

/**
 * Schema for potential lead.
 */
export const LeadInputSchema = z.object({
  id: z.uuid(),
  platform: z.string(),
  url: z.url(),
  content: z.record(z.string(), z.unknown()),
  targetDescription: z.string(),
});

export type LeadInput = z.infer<typeof LeadInputSchema>;
