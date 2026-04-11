import { canonicalizePostUrl } from "../lib/reddit-url.js";
import { parsePostPage } from "../parsers/reddit-post-parser.js";
import type { ProcessPostResult, PendingPostRecord } from "../domain/post.js";
import type { 
  ProcessedUrlStore, 
  PostRepository, 
  LeadQueuePublisher,
  IdGenerator,
  Clock
} from "./interfaces.js";

/**
 * Orchestrator for processing a single discovered post.
 * Coordinates normalization, deduplication, parsing, persistence, and queueing.
 */
export class PostProcessor {
  constructor(
    private readonly urlStore: ProcessedUrlStore,
    private readonly postRepo: PostRepository,
    private readonly queuePublisher: LeadQueuePublisher,
    private readonly idGen: IdGenerator,
    private readonly clock: Clock
  ) {}

  /**
   * Processes a single discovered post.
   * @param url The final loaded URL of the post.
   * @param html The HTML content of the page.
   * @param topic The subreddit topic (derived from URL or passed through).
   */
  async process(url: string, html: string, topic: string): Promise<ProcessPostResult> {
    const canonicalUrl = canonicalizePostUrl(url);

    // 1. Check for cross-run duplicates
    if (await this.urlStore.has(canonicalUrl)) {
      return "duplicate";
    }

    // 2. Acquire a temporary claim to reduce races between parallel processes/runs
    const claimed = await this.urlStore.claim(canonicalUrl);
    if (!claimed) {
      return "duplicate";
    }

    try {
      // 3. Parse the page HTML into structured domain types
      const extracted = parsePostPage(html, topic);
      if (!extracted) {
        console.error(`Failed to parse post content for: ${canonicalUrl}. The page shape might have changed.`);
        return "failed";
      }

      // 4. Build the record
      const id = this.idGen.generate();
      
      const record: PendingPostRecord = {
        ...extracted,
        id,
        url: canonicalUrl,
        platform: "reddit",
        status: "pending",
        createdAt: this.clock.now(),
      };

      // 5. Insert the row into SQL
      await this.postRepo.insert(record);

      try {
        // 6. Push a payload to the worker queue
        await this.queuePublisher.publish({
          id,
          platform: "reddit",
        });

        // 7. Mark as permanently processed in the cross-run store
        await this.urlStore.mark(canonicalUrl);

        return "inserted";
      } catch (queueOrMarkError) {
        // If queue or mark fails, the DB record already exists.
        // Update the DB record to error state so it's not forgotten.
        const errorMsg = queueOrMarkError instanceof Error ? queueOrMarkError.message : String(queueOrMarkError);
        await this.postRepo.updateStatus(id, "error", `Queue/Mark failure: ${errorMsg}`);
        
        // Return failed to indicate it wasn't a clean success
        return "failed";
      }
    } catch (error) {
      console.error(`Error processing post ${canonicalUrl}:`, error);
      return "failed";
    } finally {
      // 8. Always release the claim/lock
      await this.urlStore.release(canonicalUrl);
    }
  }
}
