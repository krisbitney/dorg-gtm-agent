import { createWorkflow, createStep } from '@mastra/core/workflows';

import { leadAnalysisAgent } from '../agents/lead-analysis-agent';
import { LeadInputSchema } from '../schemas/lead-input-schema';
import { LeadAnalysisResultSchema } from '../schemas/lead-analysis-result-schema';
import { formatLeadForLlm } from '../prompts/format-lead-for-llm';

/**
 * Workflow for determining if a potential lead is a lead and extracting its details.
 */
export const leadAnalysisWorkflow = createWorkflow({
  id: 'lead-analysis-workflow',
  inputSchema: LeadInputSchema,
  outputSchema: LeadAnalysisResultSchema,
})
  .then(
    createStep({
      id: 'lead-analysis',
      inputSchema: LeadInputSchema,
      outputSchema: LeadAnalysisResultSchema,
      execute: async ({ inputData, abortSignal, mastra }) => {
        const logger = mastra.getLogger();
        const prompt = formatLeadForLlm(inputData);

        logger.info(`[Lead ${inputData.id}] Step: lead-analysis. Generating lead analysis with LLM.`);
        const result = await leadAnalysisAgent.generate(prompt, {
          structuredOutput: {
            schema: LeadAnalysisResultSchema,
          },
          abortSignal,
        });
        logger.info(`[Lead ${inputData.id}] LLM generated lead analysis. isLead: ${result.object.isLead}`);
        return result.object;
      },
    }),
  )
  .commit();
