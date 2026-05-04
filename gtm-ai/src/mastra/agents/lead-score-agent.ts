import { Agent } from '@mastra/core/agent';
import { appEnv } from '../config/app-env';
import { buildLeadScorePrompt } from '../prompts/build-lead-score-prompt';

/**
 * Agent responsible for estimating the likelihood that content is a promising lead for a consultancy.
 */
export const leadScoreAgent = new Agent({
  name: 'Lead Score Agent',
  id: 'lead-score-agent',
  description: 'Estimates the likelihood of content being a lead for a consultancy (0 to 1).',
  instructions: buildLeadScorePrompt(),
  model: appEnv.GTM_SMALL_MODEL,
  maxRetries: 5,
  maxProcessorRetries: 5,
});
