import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { leadScoreAgent } from '../agents/lead-score-agent';
import { CrawlerPostInput, CrawlerPostInputSchema } from '../schemas/crawler-post-input-schema';
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
      execute: async ({ inputData, mastra }) => {
        const logger = mastra.getLogger();
        logger.info(`[Post ${inputData.id}] Step: format-prompt. Formatting crawler post for LLM.`);
        const prompt = formatCrawlerPostForLLM(inputData);
        return { prompt };
      },
    }),
  )
  .then(
    createStep({
      id: 'lead-score',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: LeadScoreResultSchema,
      execute: async ({ inputData, abortSignal, mastra, getInitData }) => {
        const logger = mastra.getLogger();
        const initData = getInitData() as CrawlerPostInput;
        const postId = initData.id;

        logger.info(`[Post ${postId}] Step: lead-score. Generating lead score with LLM.`);
        const result = await leadScoreAgent.generate(inputData.prompt, {
          structuredOutput: {
            schema: LeadScoreResultSchema,
          },
          abortSignal,
        });
        logger.info(`[Post ${postId}] LLM generated lead score: ${result.object.leadProbability}`);
        return result.object;
      },
    }),
  )
  .then(
    createStep({
      id: 'normalize-result',
      inputSchema: LeadScoreResultSchema,
      outputSchema: LeadScoreResultSchema,
      execute: async ({ inputData, mastra, getInitData }) => {
        const logger = mastra.getLogger();
        const initData = getInitData() as CrawlerPostInput;
        const postId = initData.id;

        logger.info(`[Post ${postId}] Step: normalize-result. Normalizing lead score result.`);
        const result = normalizeLeadScoreResult(inputData);
        logger.info(`[Post ${postId}] Lead score workflow completed.`);
        return result;
      },
    }),
  )
  .commit();
