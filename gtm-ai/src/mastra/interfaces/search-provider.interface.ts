/**
 * Parameters for a single web search.
 */
export interface SearchParams {
  query: string;
  site: string;
  startDateTime: string;
  endDateTime: string;
  page?: number,
}

/**
 * A single organic search result from a SERP provider.
 */
export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

/**
 * Response from a search provider containing ranked results.
 */
export interface SearchResponse {
  results: SearchResult[];
}

/**
 * Interface for a web search provider (e.g., Serper.dev).
 * Different providers may handle site and time-range parameters differently,
 * so each implementation is responsible for translating these into the
 * provider-specific format.
 */
export interface SearchProviderInterface {
  search(options: SearchParams): Promise<SearchResponse>;
}
