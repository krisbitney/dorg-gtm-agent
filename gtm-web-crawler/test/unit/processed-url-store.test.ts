import { describe, it, expect, mock, beforeEach } from "bun:test";
import { RedisProcessedUrlStore } from "../../src/storage/redis-processed-url-store.js";

describe("RedisProcessedUrlStore", () => {
    let store: RedisProcessedUrlStore;
    let mockRedis: any;

    beforeEach(() => {
        mockRedis = {
            sismember: mock(async () => false),
            sadd: mock(async () => 1),
            send: mock(async () => "OK"),
            del: mock(async () => 1),
        };
        store = new RedisProcessedUrlStore(mockRedis);
    });

    it("should check if a URL is in the set using has()", async () => {
        const url = "https://example.com";
        mockRedis.sismember.mockResolvedValue(true);
        
        const result = await store.has(url);

        expect(result).toBe(true);
        expect(mockRedis.sismember).toHaveBeenCalledWith("processed_urls", url);
    });

    it("should return false for has() if URL is not in the set", async () => {
        const url = "https://not-found.com";
        mockRedis.sismember.mockResolvedValue(false);
        
        const result = await store.has(url);

        expect(result).toBe(false);
    });

    it("should mark a URL as processed by adding it to the set", async () => {
        const url = "https://example.com";
        
        await store.mark(url);

        expect(mockRedis.sadd).toHaveBeenCalledWith("processed_urls", url);
    });

    it("should claim a URL using SET key value EX ttl NX", async () => {
        const url = "https://example.com";
        mockRedis.send.mockResolvedValue("OK");
        
        const result = await store.claim(url);

        expect(result).toBe(true);
        expect(mockRedis.send).toHaveBeenCalledWith("SET", [
            expect.stringContaining(url), 
            "1", 
            "EX", 
            expect.any(String), 
            "NX"
        ]);
    });

    it("should return false if claim() fails because the key already exists", async () => {
        const url = "https://example.com";
        mockRedis.send.mockResolvedValue(null); // SET NX returns null if already exists
        
        const result = await store.claim(url);

        expect(result).toBe(false);
    });

    it("should release a URL by deleting the claim key", async () => {
        const url = "https://example.com";
        
        await store.release(url);

        expect(mockRedis.del).toHaveBeenCalledWith(expect.stringContaining(url));
    });
});
