import { Agent } from '@mastra/core/agent';
import { appEnv } from '../config/app-env';

/**
 * Agent responsible for evaluating search result titles and snippets
 * to identify which URLs are promising enough to scrape for full content.
 */
export const searchFilterAgent = new Agent({
  name: 'Search Filter Agent',
  id: 'search-filter-agent',
  description: 'Evaluates search result titles and snippets to identify potential leads.',
  instructions:
    'You are an expert lead analyst. Evaluate search result titles and snippets to identify potential leads for a consultancy. Return only the URLs that have a realistic chance of being a lead based on the available information.',
  model: appEnv.GTM_SEARCH_FILTER_MODEL,
  maxRetries: 3,
  maxProcessorRetries: 3,
});
