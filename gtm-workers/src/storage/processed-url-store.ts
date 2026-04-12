import { appEnv } from "../config/app-env.js";

/**
 * Interface for the processed URL store.
 */
export interface ProcessedUrlStoreInterface {
  has(url: string): Promise<boolean>;
  mark(url: string): Promise<void>;
  claim(url: string): Promise<boolean>;
  release(url: string): Promise<void>;
}

/**
 * Concrete implementation of ProcessedUrlStore using Bun's built-in Redis client.
 * Uses a Redis SET for tracking processed URLs and SETNX for temporary claims.
 */
export class RedisProcessedUrlStore implements ProcessedUrlStoreInterface {
  private readonly redis = Bun.redis;
  private readonly processedUrlsKey = appEnv.PROCESSED_URLS_KEY;
  private readonly claimPrefix = "claim:";
  private readonly claimTtlSecs = 3600; // 1 hour

  constructor() {
    // If not already connected, connect to Redis
    if (!this.redis.connected) {
      this.redis.connect();
    }
  }

  /**
   * Checks if the URL has already been processed using a Redis SET.
   */
  async has(url: string): Promise<boolean> {
    const result = await this.redis.sismember(this.processedUrlsKey, url);
    return Boolean(result);
  }

  /**
   * Marks the URL as permanently processed by adding it to the Redis SET.
   */
  async mark(url: string): Promise<void> {
    await this.redis.sadd(this.processedUrlsKey, url);
  }

  /**
   * Acquires a temporary claim/lock on a URL using Redis SETNX with TTL.
   */
  async claim(url: string): Promise<boolean> {
    const key = `${this.claimPrefix}${url}`;
    const result = await this.redis.set(key, "1", "EX", String(this.claimTtlSecs), "NX");
    return result === "OK";
  }

  /**
   * Releases a temporary claim/lock on a URL by deleting its key.
   */
  async release(url: string): Promise<void> {
    const key = `${this.claimPrefix}${url}`;
    await this.redis.del(key);
  }
}
