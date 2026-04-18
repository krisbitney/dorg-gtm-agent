import { z } from "zod";

import {platformSchema} from "./platform.ts";

/**
 * Schema for the internal trigger crawl request.
 */
export const triggerCrawlRequestSchema = z.object({
  platform: platformSchema,
  source: z.enum(["scheduler", "manual"]).default("manual"),
});

export type TriggerCrawlRequest = z.infer<typeof triggerCrawlRequestSchema>;
