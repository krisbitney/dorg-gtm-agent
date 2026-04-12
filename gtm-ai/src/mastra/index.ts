
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';

import { leadScoreWorkflow } from './workflows/lead-score-workflow';
import { leadAnalysisWorkflow } from './workflows/lead-analysis-workflow';
import { leadScoreAgent } from './agents/lead-score-agent';
import { leadAnalysisAgent } from './agents/lead-analysis-agent';
import { leadScoreAccuracyScorer } from './scorers/lead-score-accuracy-scorer';
import { leadAnalysisCompletenessScorer } from './scorers/lead-analysis-completeness-scorer';
import { createStorage } from './storage/create-storage';
import { createObservability } from './observability/create-observability';
import { appEnv } from './config/app-env';

/**
 * Main Mastra instance for the GTM AI service.
 * Composes all workflows, agents, storage, and observability.
 */
export const mastra = new Mastra({
  workflows: { 
    leadScoreWorkflow,
    leadAnalysisWorkflow,
  },
  agents: { 
    leadScoreAgent,
    leadAnalysisAgent,
  },
  scorers: {
    leadScoreAccuracyScorer,
    leadAnalysisCompletenessScorer,
  },
  storage: await createStorage(),
  logger: new PinoLogger({
    name: 'Mastra',
    level: appEnv.MASTRA_LOG_LEVEL,
  }),
  observability: createObservability(),
});
