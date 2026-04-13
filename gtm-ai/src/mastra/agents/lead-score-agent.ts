import { Agent } from '@mastra/core/agent';
import { appEnv } from '../config/app-env';
import { buildLeadScorePrompt } from '../prompts/build-lead-score-prompt';

/**
 * Agent responsible for estimating the likelihood that a social media post
 * is a promising lead for dOrg's tech/dev consultancy.
 */
export const leadScoreAgent = new Agent({
  name: 'Lead Score Agent',
  id: 'lead-score-agent',
  description: 'Estimates the likelihood of a post being a lead for the dOrg.tech web3 software development consultancy (0 to 1).',
  instructions: buildLeadScorePrompt(),
  model: appEnv.GTM_SMALL_MODEL,
  maxRetries: 5,
  maxProcessorRetries: 5,
});
