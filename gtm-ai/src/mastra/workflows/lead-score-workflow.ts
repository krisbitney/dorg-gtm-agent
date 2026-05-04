import { createWorkflow, createStep } from '@mastra/core/workflows';

import { leadScoreAgent } from '../agents/lead-score-agent';
import { LeadInputSchema } from '../schemas/lead-input-schema';
import { LeadScoreResultSchema } from '../schemas/lead-score-result-schema';
import { formatLeadForLlm } from '../prompts/format-lead-for-llm';

/**
 * Workflow for estimating the likelihood of a potential lead being a lead for the consultancy.
 */
export const leadScoreWorkflow = createWorkflow({
  id: 'lead-score-workflow',
  inputSchema: LeadInputSchema,
  outputSchema: LeadScoreResultSchema,
})
  .then(
    createStep({
      id: 'lead-score',
      inputSchema: LeadInputSchema,
      outputSchema: LeadScoreResultSchema,
      execute: async ({ inputData, abortSignal, mastra }) => {
        const logger = mastra.getLogger();

        logger.info(`[Lead ${inputData.leadId}] Step: lead-score. Generating lead score with LLM.`);
        const prompt = formatLeadForLlm(inputData);
        const result = await leadScoreAgent.generate(prompt, {
          structuredOutput: {
            schema: LeadScoreResultSchema,
          },
          abortSignal,
        });

        // normalize
        const clamped = Math.max(0, Math.min(1, result.object.leadProbability));
        const rounded = Math.round(clamped * 1000) / 1000;
        logger.info(`[Lead ${inputData.leadId}] LLM generated lead score: ${result.object.leadProbability}, normalized to ${rounded}`);
        return { leadProbability: rounded }
      },
    }),
  )
  .commit();
