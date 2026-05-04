import { Agent } from '@mastra/core/agent';
import { appEnv } from '../config/app-env';
import { buildLeadAnalysisPrompt } from '../prompts/build-lead-analysis-prompt';

/**
 * Agent responsible for determining if a post is a lead
 * and extracting relevant data.
 */
export const leadAnalysisAgent = new Agent({
  name: 'Lead Analysis Agent',
  id: 'lead-analysis-agent',
  description: 'Analyzes a post to determine if it is a lead and extracts relevant information.',
  instructions: buildLeadAnalysisPrompt(),
  model: appEnv.GTM_ANALYSIS_MODEL,
  maxRetries: 3,
  maxProcessorRetries: 3,
});
