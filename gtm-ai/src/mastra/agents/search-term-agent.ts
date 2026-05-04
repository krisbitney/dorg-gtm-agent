import { Agent } from '@mastra/core/agent';
import { appEnv } from '../config/app-env';

/**
 * Agent responsible for generating search queries to find potential leads.
 * The prompt instructions are built dynamically per invocation based on the
 * target description, site, and filter terms.
 */
export const searchTermAgent = new Agent({
  name: 'Search Term Agent',
  id: 'search-term-agent',
  description: 'Generates search queries optimized for finding leads on a given platform.',
  instructions:
    'You are an expert search strategist. Generate specific, varied search queries optimized for finding potential sales leads.',
  model: appEnv.GTM_SEARCH_TERM_MODEL,
  maxRetries: 3,
  maxProcessorRetries: 3,
});
