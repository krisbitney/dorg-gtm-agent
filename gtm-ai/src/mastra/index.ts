
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';

import { leadScoreWorkflow } from './workflows/lead-score-workflow';
import { leadAnalysisWorkflow } from './workflows/lead-analysis-workflow';
import { searchTermGenerationWorkflow } from './workflows/search-term-generation-workflow';
import { searchAndFilterWorkflow } from './workflows/search-and-filter-workflow';
import { leadScoreAgent } from './agents/lead-score-agent';
import { leadAnalysisAgent } from './agents/lead-analysis-agent';
import { searchTermAgent } from './agents/search-term-agent';
import { searchFilterAgent } from './agents/search-filter-agent';
import { leadAnalysisCompletenessScorer } from './scorers/lead-analysis-completeness-scorer';
import { searchWebTool } from './tools/search-web.tool';
import { scrapePageTool } from './tools/scrape-page.tool';
import { createStorage } from './storage/create-storage';
import { createObservability } from './observability/create-observability';
import { appEnv } from './config/app-env';

/**
 * Main Mastra instance for the GTM AI service.
 * Composes all workflows, agents, tools, storage, and observability.
 */
export const mastra = new Mastra({
  workflows: {
    leadScoreWorkflow,
    leadAnalysisWorkflow,
    searchTermGenerationWorkflow,
    searchAndFilterWorkflow,
  },
  agents: {
    leadScoreAgent,
    leadAnalysisAgent,
    searchTermAgent,
    searchFilterAgent,
  },
  tools: {
    searchWebTool,
    scrapePageTool,
  },
  scorers: {
    leadAnalysisCompletenessScorer,
  },
  storage: await createStorage(),
  logger: new PinoLogger({
    name: 'Mastra',
    level: appEnv.MASTRA_LOG_LEVEL,
  }),
  observability: createObservability(),
});
