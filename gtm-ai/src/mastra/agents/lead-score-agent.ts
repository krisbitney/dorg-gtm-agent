import { Agent } from '@mastra/core/agent';
import { appEnv } from '../config/app-env';
import { buildLeadScorePrompt } from '../prompts/build-lead-score-prompt';

/**
 * Agent responsible for evaluating extracted page content and
 * assigning a probability score (0.0 to 1.0) indicating B2B lead quality.
 */
export const leadScoreAgent = new Agent({
  name: 'Lead Score Agent',
  id: 'lead-score-agent',
  description: 'Estimates the likelihood of extracted content being a high-intent B2B lead (0.0 to 1.0).',
  instructions: buildLeadScorePrompt(),
  model: appEnv.GTM_SCORE_MODEL,
  maxRetries: 5,
  maxProcessorRetries: 5,
});
