import type { LeadQueuePublisher } from "../services/interfaces.js";
import type { QueuePayload } from "../domain/post.js";
import { config } from "../config/config.js";

/**
 * Concrete implementation of LeadQueuePublisher using Bun's built-in Redis client.
 */
export class RedisQueuePublisher implements LeadQueuePublisher {
    private readonly queueName = "leads_queue";

    constructor(private readonly redis = new Bun.RedisClient(config.REDIS_URL)) {}

    /**
     * Publishes a lead payload to the queue.
     * @param payload The payload to publish.
     */
    async publish(payload: QueuePayload): Promise<void> {
        await this.redis.lpush(this.queueName, JSON.stringify(payload));
    }
}
