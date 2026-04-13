import { z } from "zod";

/**
 * Zod schema for the crawler configuration as Apify Actor input.
 */
export const inputSchema = z.object({
  startUrls: z.array(z.url()),
  maxCrawlDepth: z.number().int().positive().default(10),
  maxRequestsPerCrawl: z.number().int().positive().optional(),
  maxRequestsPerMinute: z.number().int().positive().default(20),
  sameDomainDelaySecs: z.number().int().nonnegative().default(0),
  maxConcurrency: z.number().int().positive().default(1),
  maxRequestRetries: z.number().int().nonnegative().default(3),
  maxSessionRotations: z.number().int().nonnegative().default(10),
  requestTimeoutMs: z.number().int().positive().default(60_000),
  navigationTimeoutMs: z.number().int().positive().default(60_000),
});

export type ActorInput = z.infer<typeof inputSchema>;
