import { describe, it, expect, mock, beforeEach } from "bun:test";
import { RedisQueuePublisher } from "../../src/storage/redis-queue-publisher.js";

describe("RedisQueuePublisher", () => {
    let publisher: RedisQueuePublisher;
    let mockRedis: any;

    beforeEach(() => {
        mockRedis = {
            lpush: mock(async () => {}),
        };
        publisher = new RedisQueuePublisher(mockRedis);
    });

    it("should publish the exact payload shape and serialization", async () => {
        const payload = { id: "uuid-v7-123", platform: "reddit" as const };
        
        await publisher.publish(payload);

        expect(mockRedis.lpush).toHaveBeenCalledWith("leads_queue", JSON.stringify(payload));
    });
});
