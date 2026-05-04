import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { leadAnalysisAgent } from '../agents/lead-analysis-agent';
import { CrawlerPostInput, LeadInputSchema } from '../schemas/lead-input-schema';
import { LeadAnalysisResultSchema } from '../schemas/lead-analysis-result-schema';
import { formatCrawlerPostForLLM } from '../prompts/format-crawler-post-for-llm';

/**
 * Workflow for determining if a post is a lead and extracting its details.
 */
export const leadAnalysisWorkflow = createWorkflow({
  id: 'lead-analysis-workflow',
  inputSchema: LeadInputSchema,
  outputSchema: LeadAnalysisResultSchema,
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
      id: 'lead-analysis',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: LeadAnalysisResultSchema,
      execute: async ({ inputData, abortSignal, mastra, getInitData }) => {
        const logger = mastra.getLogger();
        const initData = getInitData() as CrawlerPostInput;
        const postId = initData.id;

        logger.info(`[Post ${postId}] Step: lead-analysis. Generating lead analysis with LLM.`);
        const result = await leadAnalysisAgent.generate(inputData.prompt, {
          structuredOutput: {
            schema: LeadAnalysisResultSchema,
          },
          abortSignal,
        });
        logger.info(`[Post ${postId}] LLM generated lead analysis. isLead: ${result.object.isLead}`);
        return result.object;
      },
    }),
  )
  .commit();
