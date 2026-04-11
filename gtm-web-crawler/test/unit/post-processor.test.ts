import { test, expect, describe, beforeEach } from "bun:test";
import { PostProcessor } from "../../src/services/post-processor.js";
import type { 
  ProcessedUrlStore, 
  PostRepository, 
  LeadQueuePublisher, 
  IdGenerator, 
  Clock 
} from "../../src/services/interfaces.js";
import type { PendingPostRecord, QueuePayload, CrawlStatus } from "../../src/domain/post.js";

class FakeUrlStore implements ProcessedUrlStore {
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

class FakePostRepo implements PostRepository {
  records: PendingPostRecord[] = [];
  async insert(record: PendingPostRecord) { this.records.push(record); }
  async updateStatus(id: string, status: CrawlStatus, errorMessage?: string) {
    const record = this.records.find(r => r.id === id);
    if (record) {
      record.status = status;
    }
  }
}

class FakeQueuePublisher implements LeadQueuePublisher {
  payloads: QueuePayload[] = [];
  async publish(payload: QueuePayload) { this.payloads.push(payload); }
}

class FakeIdGen implements IdGenerator {
  generate() { return "test-id"; }
}

class FakeClock implements Clock {
  now() { return new Date("2024-01-01T00:00:00Z"); }
}

const HAPPY_PATH_HTML = `
  <div class="thing link" data-author="testuser">
    <p class="title"><a class="title" href="/r/CryptoCurrency/comments/123/title">Test Title</a></p>
    <p class="tagline">submitted <time datetime="2024-01-01T00:00:00Z">just now</time> by <a class="author">testuser</a> to <a class="subreddit">r/CryptoCurrency</a></p>
    <div class="usertext-body"><div class="md"><p>Test content</p></div></div>
    <div class="midcol">
      <div class="score unvoted">123</div>
    </div>
    <a class="comments">45 comments</a>
  </div>
`;

describe("PostProcessor", () => {
  let urlStore: FakeUrlStore;
  let postRepo: FakePostRepo;
  let queuePublisher: FakeQueuePublisher;
  let processor: PostProcessor;

  beforeEach(() => {
    urlStore = new FakeUrlStore();
    postRepo = new FakePostRepo();
    queuePublisher = new FakeQueuePublisher();
    processor = new PostProcessor(
      urlStore,
      postRepo,
      queuePublisher,
      new FakeIdGen(),
      new FakeClock()
    );
  });

  test("should insert and publish exactly once on happy path", async () => {
    const result = await processor.process(
      "https://old.reddit.com/r/CryptoCurrency/comments/123/title",
      HAPPY_PATH_HTML,
      "CryptoCurrency"
    );

    expect(result).toBe("inserted");
    expect(postRepo.records.length).toBe(1);
    expect(queuePublisher.payloads.length).toBe(1);
    expect(await urlStore.has("https://old.reddit.com/r/CryptoCurrency/comments/123/title")).toBe(true);
    expect(urlStore.claims.has("https://old.reddit.com/r/CryptoCurrency/comments/123/title")).toBe(false); // released
    
    const record = postRepo.records[0];
    expect(record?.id).toBe("test-id");
    expect(record?.username).toBe("testuser");
    expect(record?.topic).toBe("CryptoCurrency");
    expect(record?.status).toBe("pending");
  });

  test("should short-circuit if already processed", async () => {
    const url = "https://old.reddit.com/r/CryptoCurrency/comments/123/title";
    await urlStore.mark(url);

    const result = await processor.process(url, HAPPY_PATH_HTML, "CryptoCurrency");

    expect(result).toBe("duplicate");
    expect(postRepo.records.length).toBe(0);
  });

  test("should short-circuit if claim fails", async () => {
    const url = "https://old.reddit.com/r/CryptoCurrency/comments/123/title";
    await urlStore.claim(url);

    const result = await processor.process(url, HAPPY_PATH_HTML, "CryptoCurrency");

    expect(result).toBe("duplicate");
    expect(postRepo.records.length).toBe(0);
  });

  test("should handle repository failure and not mark processed", async () => {
    postRepo.insert = async () => { throw new Error("DB Error"); };

    const result = await processor.process(
      "https://old.reddit.com/r/CryptoCurrency/comments/123/title",
      HAPPY_PATH_HTML,
      "CryptoCurrency"
    );

    expect(result).toBe("failed");
    expect(await urlStore.has("https://old.reddit.com/r/CryptoCurrency/comments/123/title")).toBe(false);
    expect(urlStore.claims.has("https://old.reddit.com/r/CryptoCurrency/comments/123/title")).toBe(false); // released
  });

  test("should update to error state if queue failure after insert", async () => {
    queuePublisher.publish = async () => { throw new Error("Queue Error"); };

    const result = await processor.process(
      "https://old.reddit.com/r/CryptoCurrency/comments/123/title",
      HAPPY_PATH_HTML,
      "CryptoCurrency"
    );

    expect(result).toBe("failed");
    expect(postRepo.records.length).toBe(1);
    expect(postRepo.records[0]?.status).toBe("error");
    expect(await urlStore.has("https://old.reddit.com/r/CryptoCurrency/comments/123/title")).toBe(false);
  });

  describe("isDuplicate", () => {
    test("should return true if already processed", async () => {
      const url = "https://old.reddit.com/r/CryptoCurrency/comments/123/title";
      await urlStore.mark(url);
      expect(await processor.isDuplicate(url)).toBe(true);
    });

    test("should return false if not processed", async () => {
      const url = "https://old.reddit.com/r/CryptoCurrency/comments/123/title";
      expect(await processor.isDuplicate(url)).toBe(false);
    });

    test("should canonicalize URL before checking", async () => {
      const canonicalUrl = "https://old.reddit.com/r/CryptoCurrency/comments/123/title";
      const nonCanonicalUrl = "https://www.reddit.com/r/CryptoCurrency/comments/123/title/?utm_source=share";
      await urlStore.mark(canonicalUrl);
      expect(await processor.isDuplicate(nonCanonicalUrl)).toBe(true);
    });
  });
});
