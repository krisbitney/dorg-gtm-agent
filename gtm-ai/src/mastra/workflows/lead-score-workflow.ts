import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { leadScoreAgent } from '../agents/lead-score-agent';
import { CrawlerPostInput, LeadInputSchema } from '../schemas/lead-input-schema';
import { LeadScoreResultSchema } from '../schemas/lead-score-result-schema';
import { formatCrawlerPostForLLM } from '../prompts/format-crawler-post-for-llm';

/**
 * Workflow for estimating the likelihood of a post being a lead for dOrg.
 */
export const leadScoreWorkflow = createWorkflow({
  id: 'lead-score-workflow',
  inputSchema: LeadInputSchema,
  outputSchema: LeadScoreResultSchema,
})
  .then(
    createStep({
      id: 'format-prompt',
      inputSchema: LeadInputSchema,
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
        const clamped = Math.max(0, Math.min(1, inputData.leadProbability));
        const rounded = Math.round(clamped * 1000) / 1000;
        logger.info(`[Post ${postId}] Lead score workflow completed.`);
        return { leadProbability: rounded }
      },
    }),
  )
  .commit();
