import { eq } from "drizzle-orm";
import type { PostRepository } from "../services/interfaces.js";
import type { PendingPostRecord, CrawlStatus } from "../domain/post.js";
import {drizzle} from "drizzle-orm/bun-sql";
import {config} from "../config/config.js";
import * as schema from "./posts-db-schema.js";
import {NewPost} from "./posts-db-schema.js";

/**
 * Concrete implementation of PostRepository using Drizzle ORM.
 */
export class DrizzlePostRepository implements PostRepository {

    constructor(private readonly db = drizzle(config.DATABASE_URL, { schema })) {}

    /**
     * Inserts a pending post record into the database.
     * @param record The post record to insert.
     */
    async insert(record: PendingPostRecord): Promise<void> {
        const post: NewPost = {
            id: record.id,
            url: record.url,
            platform: record.platform,
            topic: record.topic,
            username: record.username,
            content: record.content,
            postedAt: new Date(record.postedAt),
            likes: record.nLikes,
            nComments: record.nComments,
            status: record.status,
            createdAt: record.createdAt,
            updatedAt: record.createdAt,
        }
        await this.db.insert(schema.posts).values(post);
    }

    /**
     * Updates the status of a post record.
     * @param id The ID of the post record.
     * @param status The new status.
     * @param errorMessage Optional error message.
     */
    async updateStatus(id: string, status: CrawlStatus, errorMessage?: string): Promise<void> {
        await this.db.update(schema.posts)
            .set({ 
                status, 
                errorMessage: errorMessage ?? null 
            })
            .where(eq(schema.posts.id, id));
    }
}
