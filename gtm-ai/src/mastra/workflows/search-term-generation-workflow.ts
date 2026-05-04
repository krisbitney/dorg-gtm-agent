import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { searchTermAgent } from '../agents/search-term-agent';
import {
  SearchTermGenerationInputSchema,
  SearchTermGenerationOutputSchema,
} from '../schemas/search-term-generation-schema';
import { buildSearchTermPrompt } from '../prompts/build-search-term-prompt';

/**
 * Workflow that generates a specified number of search terms for lead generation.
 *
 * Builds a prompt from the input parameters, calls the search term agent to
 * generate query strings via structured output, and assembles full search term
 * objects by attaching the site and datetimes from the input.
 */
export const searchTermGenerationWorkflow = createWorkflow({
  id: 'search-term-generation-workflow',
  inputSchema: SearchTermGenerationInputSchema,
  outputSchema: SearchTermGenerationOutputSchema,
})
  .then(
    createStep({
      id: 'generate-search-terms',
      inputSchema: SearchTermGenerationInputSchema,
      outputSchema: SearchTermGenerationOutputSchema,
      execute: async ({ inputData, mastra }) => {
        const logger = mastra.getLogger();
        const { numberOfSearchTerms, site } = inputData;

        logger.info(
          `Generating ${numberOfSearchTerms} search queries for site "${site}".`,
        );

        const prompt = buildSearchTermPrompt(inputData);

        const result = await searchTermAgent.generate(prompt, {
          structuredOutput: {
            schema: z.object({ queries: z.array(z.string()) }),
          },
        });

        const queries = result.object.queries;
        logger.info(`Generated ${queries.length} search queries.`);

        return { queries } ;
      },
    }),
  )
  .commit();
