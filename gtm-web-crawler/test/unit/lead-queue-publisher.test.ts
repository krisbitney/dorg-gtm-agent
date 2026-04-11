import { describe, it, expect, mock, beforeEach } from "bun:test";
import { RedisQueuePublisher } from "../../src/storage/redis-queue-publisher.js";

describe("RedisQueuePublisher", () => {
    let publisher: RedisQueuePublisher;

    beforeEach(() => {
        publisher = new RedisQueuePublisher();
        // Mock Bun.redis.lpush
        (Bun.redis as any).lpush = mock(async () => {});
    });

    it("should publish the exact payload shape and serialization", async () => {
        const payload = { id: "uuid-v7-123", platform: "reddit" as const };
        
        await publisher.publish(payload);

        expect((Bun.redis as any).lpush).toHaveBeenCalledWith("leads_queue", JSON.stringify(payload));
    });
});
