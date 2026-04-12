import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { leadScoreAgent } from '../agents/lead-score-agent';
import { CrawlerPostInputSchema } from '../schemas/crawler-post-input-schema';
import { LeadScoreResultSchema } from '../schemas/lead-score-result-schema';
import { formatCrawlerPostForLLM } from '../prompts/format-crawler-post-for-llm';

import { normalizeLeadScoreResult } from './normalize-lead-score-result';

/**
 * Workflow for estimating the likelihood of a post being a lead for dOrg.
 */
export const leadScoreWorkflow = createWorkflow({
  id: 'lead-score-workflow',
  inputSchema: CrawlerPostInputSchema,
  outputSchema: LeadScoreResultSchema,
})
  .then(
    createStep({
      id: 'format-prompt',
      inputSchema: CrawlerPostInputSchema,
      outputSchema: z.object({ prompt: z.string() }),
      execute: async ({ inputData }) => {
        const prompt = formatCrawlerPostForLLM(inputData);
        return { prompt };
      },
    }),
  )
  .then(
    createStep(leadScoreAgent, {
      structuredOutput: {
        schema: LeadScoreResultSchema,
      },
    }),
  )
  .then(
    createStep({
      id: 'normalize-result',
      inputSchema: LeadScoreResultSchema,
      outputSchema: LeadScoreResultSchema,
      execute: async ({ inputData }) => {
        return normalizeLeadScoreResult(inputData);
      },
    }),
  )
  .commit();
