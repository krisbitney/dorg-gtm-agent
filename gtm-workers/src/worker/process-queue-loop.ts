import type { LeadQueueInterface } from "../storage/lead-queue.js";
import { ProcessLeadJob } from "./process-lead-job.js";
import { queuePayloadSchema } from "../schemas/queue-payload-schema.js";
import { LeadRepository } from "../storage/repositories/lead-repository.js";

/**
 * Use case to process leads from the Redis queue in a continuous loop.
 */
export class ProcessQueueLoop {
  constructor(
    private readonly leadQueue: LeadQueueInterface,
    private readonly leadRepository: LeadRepository,
    private readonly createJob: (workerRunId: string) => ProcessLeadJob,
    private readonly workerRunId: string
  ) {}

  /**
   * Starts the continuous queue processing loop.
   */
  async execute() {
    console.log(`[Worker ${this.workerRunId}] Starting continuous queue processing loop...`);

    // Main loop
    while (true) {
      let rawPayload = null;
      try {
        // a. Reserve next message (blocking)
        rawPayload = await this.leadQueue.reserveNext();
        if (!rawPayload) {
          console.log(`[Worker ${this.workerRunId}] No message available, waiting for next iteration...`);
          continue;
        }

        console.log(`[Worker ${this.workerRunId}] Reserved message for processing.`);

        // b. Parse and validate payload
        const payloadResult = queuePayloadSchema.safeParse(JSON.parse(rawPayload));
        if (!payloadResult.success) {
          console.error(`[Worker ${this.workerRunId}] Invalid queue payload:`, payloadResult.error.format());
          await this.leadQueue.moveToDeadLetter(rawPayload, JSON.stringify({
            error: "Invalid payload schema",
            original: rawPayload,
            failedAt: new Date().toISOString()
          }));
          continue;
        }

        const { id: leadId } = payloadResult.data;

        // c. Execute the job
        const job = this.createJob(this.workerRunId);
        await job.execute(leadId);

        // d. Acknowledge message
        await this.leadQueue.ack(rawPayload);
        console.log(`[Worker ${this.workerRunId}] Successfully processed and acknowledged post ${leadId}.`);
      } catch (error: any) {
        console.error(`[Worker ${this.workerRunId}] Error processing job for payload ${rawPayload}:`, error);
        
        if (rawPayload) {
          try {
            // Safe parse to avoid double-throw if original payload was malformed
            let leadId: string | undefined;
            try {
              const payload = JSON.parse(rawPayload);
              leadId = payload.id;
            } catch (parseError) {
              console.warn(`[Worker ${this.workerRunId}] Could not parse malformed payload for error logging:`, parseError);
            }

            if (leadId) {
              await this.leadRepository.markError(leadId, error.message || "Unknown worker error");
            }
            
            await this.leadQueue.moveToDeadLetter(rawPayload, JSON.stringify({
              error: error.message || "Unknown worker error",
              stage: "processing",
              original: rawPayload,
              failedAt: new Date().toISOString()
            }));
          } catch (dlqError) {
            console.error(`[Worker ${this.workerRunId}] Failed to move item to DLQ:`, dlqError);
          }
        }
      }
    }
  }
}
