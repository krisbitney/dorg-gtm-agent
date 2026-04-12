import { test, expect, describe, beforeEach } from "bun:test";
import { RedisLeadQueue } from "../../src/storage/lead-queue.js";
import { appEnv } from "../../src/config/app-env.js";

describe("RedisLeadQueue", () => {
  const leadQueue = new RedisLeadQueue();
  const redis = Bun.redis;

  beforeEach(async () => {
    // Clear the queues before each test
    await redis.del(appEnv.QUEUE_NAME);
    await redis.del(appEnv.QUEUE_PROCESSING_NAME);
    await redis.del(appEnv.QUEUE_DLQ_NAME);
  });

  test("should enqueue and reserve a message", async () => {
    const payload = JSON.stringify({ id: "72175949-8c67-463d-82b4-53906263884d", platform: "reddit" });
    await leadQueue.enqueue(payload);
    
    const reserved = await leadQueue.reserveNext();
    expect(reserved).toBe(payload);
  });

  test("should ack a message", async () => {
    const payload = JSON.stringify({ id: "ack-test", platform: "reddit" });
    await leadQueue.enqueue(payload);
    const reserved = await leadQueue.reserveNext();
    
    await leadQueue.ack(reserved!);
    
    // There shouldn't be anything in processing
    const processingCount = await redis.llen(appEnv.QUEUE_PROCESSING_NAME);
    expect(processingCount).toBe(0);
  });
});
