import { describe, it, expect, mock, beforeEach } from "bun:test";
import { RedisProcessedUrlStore } from "../../src/storage/redis-processed-url-store.js";

describe("RedisProcessedUrlStore", () => {
    let store: RedisProcessedUrlStore;

    beforeEach(() => {
        store = new RedisProcessedUrlStore();
        // Mock Bun.redis methods
        (Bun.redis as any).sismember = mock(async () => 0);
        (Bun.redis as any).sadd = mock(async () => 1);
        (Bun.redis as any).set = mock(async () => "OK");
        (Bun.redis as any).del = mock(async () => 1);
    });

    it("should check if a URL is in the set using has()", async () => {
        const url = "https://example.com";
        (Bun.redis as any).sismember.mockResolvedValue(1);
        
        const result = await store.has(url);

        expect(result).toBe(true);
        expect((Bun.redis as any).sismember).toHaveBeenCalledWith("processed_urls", url);
    });

    it("should return false for has() if URL is not in the set", async () => {
        const url = "https://not-found.com";
        (Bun.redis as any).sismember.mockResolvedValue(0);
        
        const result = await store.has(url);

        expect(result).toBe(false);
    });

    it("should mark a URL as processed by adding it to the set", async () => {
        const url = "https://example.com";
        
        await store.mark(url);

        expect((Bun.redis as any).sadd).toHaveBeenCalledWith("processed_urls", url);
    });

    it("should claim a URL using SET key value EX ttl NX", async () => {
        const url = "https://example.com";
        (Bun.redis as any).set.mockResolvedValue("OK");
        
        const result = await store.claim(url);

        expect(result).toBe(true);
        expect((Bun.redis as any).set).toHaveBeenCalledWith(
            expect.stringContaining(url), 
            "1", 
            "EX", 
            expect.any(Number), 
            "NX"
        );
    });

    it("should return false if claim() fails because the key already exists", async () => {
        const url = "https://example.com";
        (Bun.redis as any).set.mockResolvedValue(null); // SET NX returns null if already exists
        
        const result = await store.claim(url);

        expect(result).toBe(false);
    });

    it("should release a URL by deleting the claim key", async () => {
        const url = "https://example.com";
        
        await store.release(url);

        expect((Bun.redis as any).del).toHaveBeenCalledWith(expect.stringContaining(url));
    });
});
