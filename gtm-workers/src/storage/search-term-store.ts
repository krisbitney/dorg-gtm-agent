import { appEnv } from "../config/app-env.js";

/**
 * Interface for the search term deduplication store.
 * Prevents re-searching duplicate terms within a configurable time window.
 * Each platform has its own isolated set of search terms.
 */
export interface SearchTermDedupStoreInterface {
  /**
   * Checks if the term was recently searched for the given platform.
   * If not, marks it as seen. Returns true if the term is new.
   */
  checkAndMark(platform: string, term: string): Promise<boolean>;

  /** Adds a list of search terms to the persistent Redis set for the given platform. */
  addToSet(platform: string, terms: string[]): Promise<number>;

  /** Removes and returns a random search term from the platform's Redis set, or null if empty. */
  popRandomMember(platform: string): Promise<string | null>;
}

/**
 * Concrete implementation using Bun's built-in Redis client.
 *
 * Uses platform-scoped Redis keys:
 *   - `{prefix}{platform}:{termHash}` for per-term TTL-based dedup
 *   - `{prefix}{platform}:terms-set` for the set of available search terms
 */
export class RedisSearchTermStore implements SearchTermDedupStoreInterface {
  private readonly redis = Bun.redis;
  private readonly prefix = appEnv.SEARCH_TERM_DEDUP_PREFIX;
  private readonly ttlSecs = appEnv.SEARCH_TERM_DEDUP_TTL_SECONDS;

  constructor() {
    if (!this.redis.connected) {
      this.redis.connect();
    }
  }

  async checkAndMark(platform: string, term: string): Promise<boolean> {
    const termHash = Bun.hash(term).toString(16);
    const key = `${this.prefix}${platform}:${termHash}`;
    const result = await this.redis.set(key, "1", "EX", String(this.ttlSecs), "NX");
    return result === "OK";
  }

  async addToSet(platform: string, terms: string[]): Promise<number> {
    const key = `${this.prefix}${platform}:terms-set`;
    return await this.redis.sadd(key, ...terms);
  }

  async popRandomMember(platform: string): Promise<string | null> {
    const key = `${this.prefix}${platform}:terms-set`;
    return await this.redis.spop(key);
  }
}
