import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { leadAnalysisAgent } from '../agents/lead-analysis-agent';
import { CrawlerPostInputSchema } from '../schemas/crawler-post-input-schema';
import { LeadAnalysisResultSchema } from '../schemas/lead-analysis-result-schema';
import { LeadAnalysisRawResultSchema } from '../schemas/lead-analysis-raw-result-schema';
import { formatCrawlerPostForLLM } from '../prompts/format-crawler-post-for-llm';

import { normalizeLeadAnalysisResult } from './normalize-lead-analysis-result';

/**
 * Workflow for determining if a post is a lead and extracting its details.
 */
export const leadAnalysisWorkflow = createWorkflow({
  id: 'lead-analysis-workflow',
  inputSchema: CrawlerPostInputSchema,
  outputSchema: LeadAnalysisResultSchema,
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
    createStep(leadAnalysisAgent, {
      structuredOutput: {
        schema: LeadAnalysisRawResultSchema,
      },
    }),
  )
  .then(
    createStep({
      id: 'normalize-result',
      inputSchema: LeadAnalysisRawResultSchema,
      outputSchema: LeadAnalysisResultSchema,
      execute: async ({ inputData }) => {
        return normalizeLeadAnalysisResult(inputData);
      },
    }),
  )
  .commit();
