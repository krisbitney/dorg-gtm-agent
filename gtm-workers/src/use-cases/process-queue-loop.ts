import type { LeadQueueInterface } from "../storage/lead-queue.js";
import { ProcessPostJob } from "./process-post-job.js";
import { queuePayloadSchema } from "../schemas/queue-payload-schema.js";
import { PostRepository } from "../storage/repositories/post-repository.js";

/**
 * Use case to process leads from the Redis queue in a continuous loop.
 */
export class ProcessQueueLoop {
  constructor(
    private readonly leadQueue: LeadQueueInterface,
    private readonly postRepository: PostRepository,
    private readonly createJob: (workerRunId: string) => ProcessPostJob,
    private readonly workerRunId: string
  ) {}

  /**
   * Starts the continuous queue processing loop.
   */
  async execute() {
    console.log(`Worker starting with run ID: ${this.workerRunId}`);

    // Main loop
    while (true) {
      let rawPayload = null;
      try {
        // a. Reserve next message (blocking)
        rawPayload = await this.leadQueue.reserveNext();
        if (!rawPayload) {
          continue;
        }

        // b. Parse and validate payload
        const payloadResult = queuePayloadSchema.safeParse(JSON.parse(rawPayload));
        if (!payloadResult.success) {
          console.error("Invalid queue payload:", payloadResult.error.format());
          await this.leadQueue.moveToDeadLetter(rawPayload, JSON.stringify({
            error: "Invalid payload schema",
            original: rawPayload,
            failedAt: new Date().toISOString()
          }));
          continue;
        }

        const { id: postId } = payloadResult.data;

        // c. Execute the job
        const job = this.createJob(this.workerRunId);
        await job.execute(postId);

        // d. Acknowledge message
        await this.leadQueue.ack(rawPayload);
      } catch (error: any) {
        console.error(`Error processing job for payload ${rawPayload}:`, error);
        
        if (rawPayload) {
          try {
            // Safe parse to avoid double-throw if original payload was malformed
            let postId: string | undefined;
            try {
              const payload = JSON.parse(rawPayload);
              postId = payload.id;
            } catch (parseError) {
              console.warn("Could not parse malformed payload for error logging:", parseError);
            }

            if (postId) {
              await this.postRepository.markError(postId, error.message || "Unknown worker error");
            }
            
            await this.leadQueue.moveToDeadLetter(rawPayload, JSON.stringify({
              error: error.message || "Unknown worker error",
              stage: "processing",
              original: rawPayload,
              failedAt: new Date().toISOString()
            }));
          } catch (dlqError) {
            console.error("Failed to move item to DLQ:", dlqError);
          }
        }
      }
    }
  }
}
