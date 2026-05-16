import {appEnv} from "../config/app-env.js";

/**
 * Interface for URL deduplication using a Redis SET.
 * Used to filter search results by checking URLs against a bloom filter
 * (Redis set) to avoid processing the same URL more than once.
 */
export interface ReadonlyUrlDedupStoreInterface {
  /** Returns true if the URL has already been processed. */
  has(url: string): Promise<boolean>;
}

/**
 * Concrete implementation using a Redis SET with no expiration.
 */
export class RedisReadonlyUrlDedupStore implements ReadonlyUrlDedupStoreInterface {
  private readonly redis = Bun.redis;
  private readonly key = appEnv.URLS_DEDUP_KEY;

  constructor() {
    if (!this.redis.connected) {
      this.redis.connect();
    }
  }

  async has(url: string): Promise<boolean> {
    const result = await this.redis.sismember(this.key, url);
    return Boolean(result);
  }
}
