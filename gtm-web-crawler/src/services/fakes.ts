import type { 
  ProcessedUrlStore, 
  PostRepository, 
  LeadQueuePublisher, 
  IdGenerator, 
  Clock 
} from "./interfaces.js";
import type { PendingPostRecord, QueuePayload, CrawlStatus } from "../domain/post.js";

export class FakeUrlStore implements ProcessedUrlStore {
  processed = new Set<string>();
  claims = new Set<string>();
  async has(url: string) { return this.processed.has(url); }
  async mark(url: string) { this.processed.add(url); }
  async claim(url: string) {
    if (this.claims.has(url)) return false;
    this.claims.add(url);
    return true;
  }
  async release(url: string) { this.claims.delete(url); }
}

export class FakePostRepo implements PostRepository {
  records: PendingPostRecord[] = [];
  async insert(record: PendingPostRecord) { 
    console.log(`[FakePostRepo] Inserting record for ${record.url}`);
    this.records.push(record); 
  }
  async updateStatus(id: string, status: CrawlStatus, errorMessage?: string) {
    const record = this.records.find(r => r.id === id);
    if (record) {
      record.status = status;
    }
  }
}

export class FakeQueuePublisher implements LeadQueuePublisher {
  payloads: QueuePayload[] = [];
  async publish(payload: QueuePayload) { 
    console.log(`[FakeQueuePublisher] Publishing payload for ${payload.id}`);
    this.payloads.push(payload); 
  }
}

export class RealIdGen implements IdGenerator {
  generate() { return Bun.randomUUIDv7(); }
}

export class RealClock implements Clock {
  now() { return new Date(); }
}
