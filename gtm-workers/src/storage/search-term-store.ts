import { appEnv } from "../config/app-env.js";

/**
 * Interface for the search term deduplication store.
 * Prevents re-searching duplicate terms within a configurable time window.
 */
export interface SearchTermDedupStoreInterface {
  /**
   * Checks if the term was recently searched. If not, marks it as seen.
   * Returns true if the term is new (should proceed with search).
   * Returns false if the term is a duplicate (was searched recently).
   */
  checkAndMark(term: string): Promise<boolean>;

  /** Adds a search term to the persistent Redis set. */
  addToSet(term: string): Promise<void>;

  /** Removes and returns a random search term from the Redis set, or null if empty. */
  popRandomMember(): Promise<string | null>;
}

/**
 * Concrete implementation using Bun's built-in Redis client.
 *
 * Uses individual Redis keys with TTL-based expiration. Each search term is
 * hashed and stored as a key with `SET NX EX`. If the key already exists,
 * the term was searched within the TTL window and is considered a duplicate.
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

  async checkAndMark(term: string): Promise<boolean> {
    const termHash = Bun.hash(term).toString(16);
    const key = `${this.prefix}${termHash}`;
    const result = await this.redis.set(key, "1", "EX", String(this.ttlSecs), "NX");
    return result === "OK";
  }

  async addToSet(term: string): Promise<void> {
    const key = `${this.prefix}terms-set`;
    await this.redis.sadd(key, term);
  }

  async popRandomMember(): Promise<string | null> {
    const key = `${this.prefix}terms-set`;
    return await this.redis.spop(key);
  }
}
