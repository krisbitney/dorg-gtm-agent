import {appEnv} from "../config/app-env";

/**
 * Interface for URL deduplication using a Redis SET.
 * Used to filter search results by checking URLs against a bloom filter
 * (Redis set) to avoid processing the same URL more than once.
 */
export interface UrlDedupStoreInterface {
  /** Returns true if the URL has already been processed. */
  has(url: string): Promise<boolean>;
  /** Marks the URL as processed. */
  add(url: string): Promise<void>;
}

/**
 * Concrete implementation using a Redis SET with no expiration.
 */
export class RedisUrlDedupStore implements UrlDedupStoreInterface {
  private readonly redis = Bun.redis;
  private readonly key = appEnv.PROCESSED_URLS_KEY;

  constructor() {
    if (!this.redis.connected) {
      this.redis.connect();
    }
  }

  async has(url: string): Promise<boolean> {
    const result = await this.redis.sismember(this.key, url);
    return Boolean(result);
  }

  async add(url: string): Promise<void> {
    await this.redis.sadd(this.key, url);
  }
}
