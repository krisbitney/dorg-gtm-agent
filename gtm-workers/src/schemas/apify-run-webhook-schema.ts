import { z } from "zod";

/**
 * Schema for the Apify run finished webhook payload.
 * Expected when the actor reaches a terminal state.
 */
export const apifyRunWebhookSchema = z.object({
  eventType: z.string(),
  eventData: z.object({
    actorId: z.string(),
    actorRunId: z.string(),
  }),
  resource: z.object({
    id: z.string(),
    actId: z.string(),
    status: z.string(),
    defaultDatasetId: z.string().optional(),
    finishedAt: z.string().optional(),
  }),
});

export type ApifyRunWebhook = z.infer<typeof apifyRunWebhookSchema>;
