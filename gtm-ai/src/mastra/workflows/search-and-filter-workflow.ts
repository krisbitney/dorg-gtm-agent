import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

import { SerperProvider } from '../providers/serper-provider';
import { ContextDevProvider } from '../providers/context-dev-provider';
import { RedisReadonlyUrlDedupStore } from '../storage/url-dedup-store';
import { searchFilterAgent } from '../agents/search-filter-agent';
import { buildSearchFilterPrompt } from '../prompts/build-search-filter-prompt';
import { buildContentExtractionPrompt } from '../prompts/build-content-extraction-prompt';
import { appEnv } from '../config/app-env';
import {
  SearchAndFilterStateSchema,
  SearchFilterOutputSchema,
  SearchAndFilterOutputSchema,
  type SearchAndFilterState,
} from '../schemas/search-and-filter-schema';
import type { SearchResult } from '../interfaces/search-provider-interface';

const serper = new SerperProvider({ apiKey: appEnv.SERPER_API_KEY ?? '' });
const contextDev = new ContextDevProvider({ apiKey: appEnv.CONTEXT_DEV_API_KEY ?? '' });
const urlDedup = new RedisReadonlyUrlDedupStore();

/**
 * Workflow that accepts a search query in workflow state, executes the search
 * across the specified number of pages, deduplicates URLs, uses an agent to
 * identify promising results from titles and snippets, then scrapes the full
 * content of each promising URL via context.dev.
 *
 * The search config is stored in workflow state because it is unchanging.
 */
export const searchAndFilterWorkflow = createWorkflow({
  id: 'search-and-filter-workflow',
  inputSchema: z.object({}),
  stateSchema: SearchAndFilterStateSchema,
  outputSchema: SearchAndFilterOutputSchema,
})
  .then(
    createStep({
      id: 'execute-search',
      inputSchema: z.object({}),
      outputSchema: z.object({
        searchResults: z.array(
          z.object({
            url: z.string(),
            title: z.string(),
            snippet: z.string(),
          }),
        ),
      }),
      execute: async ({ state, mastra }) => {
        const logger = mastra.getLogger();
        const { searchQuery, sourceUrl, startDateTime, endDateTime, pages } =
          state as SearchAndFilterState;

        logger.info(
          `Executing search across ${pages} page(s) for site "${sourceUrl}".`,
        );

        const allResults: SearchResult[] = [];

        for (let page = 1; page <= pages; page++) {
          const response = await serper.search({
            query: searchQuery,
            sourceUrl,
            startDateTime,
            endDateTime,
            page,
          });

          for (const result of response.results) {
            if (!(await urlDedup.has(result.url))) {
              allResults.push(result);
            }
          }
        }

        logger.info(
          `Search returned ${allResults.length} unique results across ${pages} page(s).`,
        );

        return { searchResults: allResults };
      },
    }),
  )
  .then(
    createStep({
      id: 'filter-results',
      inputSchema: z.object({
        searchResults: z.array(
          z.object({
            url: z.string(),
            title: z.string(),
            snippet: z.string(),
          }),
        ),
      }),
      outputSchema: SearchFilterOutputSchema,
      execute: async ({ inputData, state, mastra }) => {
        const logger = mastra.getLogger();
        const { targetDescription } = state as SearchAndFilterState;
        const { searchResults } = inputData;

        if (searchResults.length === 0) {
          logger.info('No search results to filter.');
          return { promisingUrls: [] };
        }

        logger.info(
          `Filtering ${searchResults.length} search results with agent.`,
        );

        const prompt = buildSearchFilterPrompt({
          targetDescription,
          searchResults,
        });

        const result = await searchFilterAgent.generate(prompt, {
          structuredOutput: {
            schema: SearchFilterOutputSchema,
          },
        });

        logger.info(
          `Agent identified ${result.object.promisingUrls.length} promising URL(s).`,
        );

        return result.object;
      },
    }),
  )
  .then(
    createStep({
      id: 'scrape-leads',
      inputSchema: SearchFilterOutputSchema,
      outputSchema: SearchAndFilterOutputSchema,
      execute: async ({ inputData, mastra }) => {
        const logger = mastra.getLogger();
        const { promisingUrls } = inputData;

        if (promisingUrls.length === 0) {
          logger.info('No promising URLs to scrape.');
          return { leads: [] };
        }

        logger.info(`Scraping ${promisingUrls.length} promising URL(s).`);

        const leads: { url: string; content: string }[] = [];

        for (const { url } of promisingUrls) {
          try {
            const scraped = await contextDev.scrape({ url });
            leads.push({ url: scraped.url, content: scraped.content });
          } catch (error) {
            logger.warn(`Failed to scrape ${url}: ${error}`);
          }
        }

        logger.info(
          `Scraped ${leads.length} lead(s) from ${promisingUrls.length} promising URL(s).`,
        );

        return { leads };
      },
    }),
  )
  .then(
    createStep({
      id: 'extract-relevant-content',
      inputSchema: SearchAndFilterOutputSchema,
      outputSchema: SearchAndFilterOutputSchema,
      execute: async ({ inputData, state, mastra }) => {
        const logger = mastra.getLogger();
        const { targetDescription } = state as SearchAndFilterState;
        const { leads } = inputData;

        if (leads.length === 0) {
          logger.info('No scraped leads to extract content from.');
          return { leads: [] };
        }

        logger.info(
          `Extracting relevant content from ${leads.length} scraped page(s) one at a time.`,
        );

        const extractedLeads: { url: string; content: string }[] = [];

        for (const lead of leads) {
          const prompt = buildContentExtractionPrompt({
            targetDescription,
            lead,
          });

          const result = await searchFilterAgent.generate(prompt, {
            structuredOutput: {
              schema: SearchAndFilterOutputSchema,
            },
          });

          if (result.object.leads.length > 0) {
            extractedLeads.push(...result.object.leads);
          }
        }

        logger.info(
          `Content extraction complete. ${extractedLeads.length} lead(s) retained from ${leads.length} scraped page(s).`,
        );

        return { leads: extractedLeads };
      },
    }),
  )
  .commit();
