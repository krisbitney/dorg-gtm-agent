import type { ProcessedUrlStore } from "../services/interfaces.js";
import { config } from "../config/config.js";

/**
 * Concrete implementation of ProcessedUrlStore using Bun's built-in Redis client.
 * Uses a Redis SET for tracking processed URLs and SETNX for temporary claims.
 */
export class RedisProcessedUrlStore implements ProcessedUrlStore {
    private readonly processedUrlsKey = "processed_urls";
    private readonly claimPrefix = "claim:";
    private readonly claimTtlSecs = 3600; // 1 hour

    constructor(private readonly redis = new Bun.RedisClient(config.REDIS_URL)) {}

    /**
     * Checks if the URL has already been processed using a Redis SET.
     * @param url The canonical URL to check.
     */
    async has(url: string): Promise<boolean> {
        return await this.redis.sismember(this.processedUrlsKey, url);
    }

    /**
     * Marks the URL as permanently processed by adding it to the Redis SET.
     * @param url The canonical URL to mark.
     */
    async mark(url: string): Promise<void> {
        await this.redis.sadd(this.processedUrlsKey, url);
    }

    /**
     * Acquires a temporary claim/lock on a URL using Redis SETNX with TTL.
     * @param url The canonical URL to claim.
     */
    async claim(url: string): Promise<boolean> {
        const key = `${this.claimPrefix}${url}`;
        // In this.redis, set method takes arguments.
        // Based on prototype, it supports SET key value EX ttl NX
        const result = await this.redis.send("SET", [
            key,
            "1",
            "EX",
            String(this.claimTtlSecs),
            "NX",
        ]);
        return result === "OK";
    }

    /**
     * Releases a temporary claim/lock on a URL by deleting its key.
     * @param url The canonical URL to release.
     */
    async release(url: string): Promise<void> {
        const key = `${this.claimPrefix}${url}`;
        await this.redis.del(key);
    }
}
