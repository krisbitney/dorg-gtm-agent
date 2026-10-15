import { Agent } from '@mastra/core/agent';
import { appEnv } from '../config/app-env';
import { buildLeadAnalysisPrompt } from '../prompts/build-lead-analysis-prompt';

/**
 * Agent responsible for performing deep analysis on a potential lead to
 * verify B2B intent and extract structured sales data.
 */
export const leadAnalysisAgent = new Agent({
  name: 'Lead Analysis Agent',
  id: 'lead-analysis-agent',
  description: 'Analyzes scraped content to verify B2B lead viability and extracts structured sales intelligence.',
  instructions: buildLeadAnalysisPrompt(),
  model: appEnv.GTM_ANALYSIS_MODEL,
  maxRetries: 3,
  maxProcessorRetries: 3,
});
