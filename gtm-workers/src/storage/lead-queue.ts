import {appEnv} from "../config/app-env.js";

/**
 * Interface for the lead queue.
 */
export interface LeadQueueInterface {
  enqueue(payload: string): Promise<void>;
  reserveNext(): Promise<string | null>;
  ack(payload: string): Promise<void>;
  moveToDeadLetter(payload: string, deadLetterPayload: string): Promise<void>;
  requeueProcessing(): Promise<void>;
}

/**
 * Concrete implementation of LeadQueue using Redis lists.
 * Uses a main queue, a processing queue for atomicity, and a dead-letter queue.
 */
export class RedisLeadQueue implements LeadQueueInterface {
  private readonly redis = Bun.redis;
  private readonly mainQueue = appEnv.QUEUE_NAME;
  private readonly processingQueue = appEnv.QUEUE_PROCESSING_NAME;
  private readonly dlq = appEnv.QUEUE_DLQ_NAME;
  private readonly pollTimeout = appEnv.WORKER_POLL_TIMEOUT_SECONDS;

  constructor() {
    if (!this.redis.connected) {
      this.redis.connect();
    }
  }

  /**
   * Enqueues a new post payload into the main queue.
   */
  async enqueue(payload: string): Promise<void> {
    await this.redis.lpush(this.mainQueue, payload);
  }

  /**
   * Atomically moves an item from the main queue to the processing queue.
   * Blocks for up to pollTimeout seconds if the main queue is empty.
   */
  async reserveNext(): Promise<string | null> {
    return await this.redis.brpoplpush(this.mainQueue, this.processingQueue, this.pollTimeout);
  }

  /**
   * After successful processing, removes the message from the processing queue.
   */
  async ack(payload: string): Promise<void> {
    await this.redis.lrem(this.processingQueue, 0, payload);
  }

  /**
   * Moves a failed message to the dead-letter queue and removes it from processing.
   */
  async moveToDeadLetter(payload: string, deadLetterPayload: string): Promise<void> {
    // We add the dead letter payload to the DLQ first
    await this.redis.lpush(this.dlq, deadLetterPayload);
    // Then we remove the original payload from the processing queue
    await this.redis.lrem(this.processingQueue, 0, payload);
  }

  /**
   * Requeues all items from the processing queue back to the main queue on startup.
   */
  async requeueProcessing(): Promise<void> {
    let payload;
    while ((payload = await this.redis.rpop(this.processingQueue))) {
      await this.redis.lpush(this.mainQueue, payload);
    }
  }
}
