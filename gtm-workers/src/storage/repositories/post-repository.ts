import { eq } from "drizzle-orm";
import { db } from "../database.js";
import { posts, type Post, type NewPost } from "../schema/posts-table.js";
import { PostStatus, type PostStatusType } from "../../constants/post-status.js";

/**
 * Repository for managing post records in the database.
 */
export class PostRepository {
  /**
   * Inserts a new pending post record.
   */
  async insert(post: NewPost): Promise<void> {
    await db.insert(posts).values({
      ...post,
      updatedAt: new Date(),
    });
  }

  /**
   * Fetches a post record by its ID.
   */
  async findById(id: string): Promise<Post | undefined> {
    const results = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    return results[0];
  }

  /**
   * Fetches a post record by its URL.
   */
  async findByUrl(url: string): Promise<Post | undefined> {
    const results = await db.select().from(posts).where(eq(posts.url, url)).limit(1);
    return results[0];
  }

  /**
   * Saves the lead score result and advances the post status.
   */
  async saveScore(id: string, leadProbability: number, status: PostStatusType): Promise<void> {
    await db.update(posts)
      .set({
        leadProbability,
        status,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id));
  }

  /**
   * Saves the lead analysis result and advances the post status.
   */
  async saveAnalysis(
    id: string,
    analysis: {
      whyFit: string;
      needs: string;
      timing: string;
      contactInfo: string;
    },
    status: PostStatusType
  ): Promise<void> {
    await db.update(posts)
      .set({
        ...analysis,
        status,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id));
  }

  /**
   * Saves the claimed dOrg lead ID and advances the post status.
   */
  async saveDorgLeadId(id: string, dorgLeadId: string, status: PostStatusType): Promise<void> {
    await db.update(posts)
      .set({
        dorgLeadId,
        status,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id));
  }

  /**
   * Marks a post as having failed to claim in dOrg.
   */
  async markClaimFailed(id: string, errorMessage: string): Promise<void> {
    await db.update(posts)
      .set({
        status: PostStatus.CLAIM_FAILED,
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id));
  }

  /**
   * Marks a post as successfully completed.
   */
  async markCompleted(id: string): Promise<void> {
    await db.update(posts)
      .set({
        status: PostStatus.COMPLETED,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id));
  }

  /**
   * Marks a post as having an unexpected error.
   */
  async markError(id: string, errorMessage: string): Promise<void> {
    await db.update(posts)
      .set({
        status: PostStatus.ERROR,
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id));
  }
  
  /**
   * Updates the status of a post.
   */
  async updateStatus(id: string, status: PostStatusType): Promise<void> {
    await db.update(posts)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id));
  }
}
