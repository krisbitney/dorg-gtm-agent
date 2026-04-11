import { describe, it, expect, mock, beforeEach } from "bun:test";
import { DrizzlePostRepository } from "../../src/storage/drizzle-post-repository.js";
import {posts} from "../../src/storage/posts-db-schema.ts";

// Mock the db object with stable results to capture calls
const mockValues = mock(async () => { });
const mockInsertResult = { values: mockValues };
const mockWhere = mock(async () => { });
const mockSetResult = { where: mockWhere };
const mockSet = mock(() => mockSetResult);
const mockUpdateResult = { set: mockSet };

const mockDb = {
    insert: mock(() => mockInsertResult),
    update: mock(() => mockUpdateResult),
} as any;

describe("DrizzlePostRepository", () => {
    let repository: DrizzlePostRepository;

    beforeEach(() => {
        repository = new DrizzlePostRepository(mockDb);
        mockDb.insert.mockClear();
        mockDb.update.mockClear();
        mockValues.mockClear();
        mockSet.mockClear();
        mockWhere.mockClear();
    });

    it("should map input to the correct SQL payload on insert", async () => {
        const record = {
            id: "uuid-v7-123",
            url: "https://old.reddit.com/r/test/comments/1",
            platform: "reddit",
            topic: "test",
            username: "user1",
            content: "hello world",
            postedAt: 1625097600000, // Fixed timestamp
            nLikes: 10,
            nComments: 5,
            status: "pending",
            createdAt: new Date(),
        };

        await repository.insert(record as any);

        expect(mockDb.insert).toHaveBeenCalledWith(posts);
        expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
            id: record.id,
            url: record.url,
            platform: record.platform,
            topic: record.topic,
            username: record.username,
            content: record.content,
            likes: record.nLikes,
            nComments: record.nComments,
            status: record.status,
        }));
    });

    it("should map status and error message on updateStatus", async () => {
        const id = "uuid-v7-123";
        const status = "error";
        const errorMessage = "Something went wrong";

        await repository.updateStatus(id, status as any, errorMessage);

        expect(mockDb.update).toHaveBeenCalledWith(posts);
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
            status,
            errorMessage,
        }));
        expect(mockWhere).toHaveBeenCalled();
    });
});
