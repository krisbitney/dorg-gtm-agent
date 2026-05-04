import type { GtmAiClientInterface, SearchAndFilterOutput } from "../clients/gtm-ai-client.js";
import type { SearchTermDedupStoreInterface } from "../storage/search-term-store.js";
import type { LeadQueueInterface } from "../storage/lead-queue.js";
import { LeadRepository } from "../storage/repositories/lead-repository.js";
import { SearchRunRepository } from "../storage/repositories/search-run-repository.js";
import { SearchRunStatus } from "../constants/search-run-status.js";
import { appEnv } from "../config/app-env.js";
import { defaultTargetConsultancyDescription } from "../constants/default-target-consultancy-description.js";
import type { Platform } from "../schemas/platform.js";
import {type UrlDedupStoreInterface} from "../storage/url-dedup-store.ts";

export class SearchWorkerJob {
  constructor(
    private readonly gtmAiClient: GtmAiClientInterface,
    private readonly searchTermStore: SearchTermDedupStoreInterface,
    private readonly urlDedupStore: UrlDedupStoreInterface,
    private readonly leadQueue: LeadQueueInterface,
    private readonly leadRepository: LeadRepository,
    private readonly searchRunRepository: SearchRunRepository,
    private readonly workerRunId: string
  ) {}

  async execute(platform: Platform): Promise<void> {
    // 1. Ensure search terms are available — generate if the set is empty
    let searchQuery = await this.searchTermStore.popRandomMember();

    if (!searchQuery) {
      console.log(`[SearchWorker ${this.workerRunId}] Search term set is empty. Generating ${appEnv.SEARCH_TERMS_GENERATION_COUNT} new search terms for ${platform.name}...`);

      const context = { source: "search-worker", workerRunId: this.workerRunId };
      const result = await this.gtmAiClient.generateSearchTerms({
        numberOfSearchTerms: appEnv.SEARCH_TERMS_GENERATION_COUNT,
        sourceUrl: platform.url,
        targetDescription: defaultTargetConsultancyDescription,
      }, context);

      console.log(`[SearchWorker ${this.workerRunId}] Generated ${result.queries.length} search terms. Deduplicating...`);

      const newTerms: string[] = [];
      for (const query of result.queries) {
        const isNew = await this.searchTermStore.checkAndMark(query);
        if (isNew) {
          newTerms.push(query);
        }
      }

      if (newTerms.length > 0) {
        const addedCount = await this.searchTermStore.addToSet(newTerms);
        console.log(`[SearchWorker ${this.workerRunId}] Added ${addedCount} new search terms to the set.`);
      }

      searchQuery = await this.searchTermStore.popRandomMember();
    }

    if (!searchQuery) {
      console.log(`[SearchWorker ${this.workerRunId}] No search terms available even after generation. Waiting for next iteration.`);
      return;
    }

    // 2. Execute search-and-filter workflow
    const runId = Bun.randomUUIDv7();
    const endDateTime = new Date().toISOString();
    const startDateTime = new Date(Date.now() - appEnv.SEARCH_DAYS_BACK * 24 * 60 * 60 * 1000).toISOString();

    await this.searchRunRepository.insert({
      id: runId,
      searchQuery,
      site: platform.name,
      status: SearchRunStatus.SEARCHING,
    });

    console.log(`[SearchWorker ${this.workerRunId}] Executing search for "${searchQuery}" on ${platform.url}...`);

    let searchResult: SearchAndFilterOutput;
    try {
      searchResult = await this.gtmAiClient.searchAndFilter({
        searchQuery,
        sourceUrl: platform.url,
        startDateTime,
        endDateTime,
        pages: appEnv.SEARCH_PAGES,
        targetDescription: defaultTargetConsultancyDescription,
      }, { source: "search-worker", workerRunId: this.workerRunId, searchRunId: runId });
    } catch (error: any) {
      console.error(`[SearchWorker ${this.workerRunId}] Search failed:`, error.message);
      await this.searchRunRepository.markFailed(runId, error.message || "Unknown error");
      throw error;
    }

    const resultsFound = searchResult.leads.length;
    console.log(`[SearchWorker ${this.workerRunId}] Search found ${resultsFound} results.`);

    // 3. Import results into leads table and enqueue
    let resultsImported = 0;
    for (const scrapedLead of searchResult.leads) {
      if (await this.urlDedupStore.has(scrapedLead.url)) {
        continue;
      }
      try {
        const leadId = Bun.randomUUIDv7();
        await this.leadRepository.insert({
          id: leadId,
          url: scrapedLead.url,
          platform: platform.name,
          content: { text: scrapedLead.content },
        });

        await this.leadQueue.enqueue(JSON.stringify({
          id: leadId,
          url: scrapedLead.url,
        }));

        // add url to dedup store
        await this.urlDedupStore.add(scrapedLead.url);

        resultsImported++;
      } catch (error: any) {
        console.error(`[SearchWorker ${this.workerRunId}] Failed to import lead ${scrapedLead.url}:`, error.message);
      }
    }

    await this.searchRunRepository.markCompleted(runId, { resultsFound, resultsImported });
    console.log(`[SearchWorker ${this.workerRunId}] Imported ${resultsImported}/${resultsFound} results for search run ${runId}.`);
  }
}
