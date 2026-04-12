import { test, expect, describe } from "bun:test";
import { mapPostToAiInput } from "../../src/clients/gtm-ai-client.js";

describe("mapPostToAiInput", () => {
  test("should map a database post to AI input", () => {
    const post = {
      id: "post1",
      platform: "reddit",
      topic: "web3",
      url: "https://reddit.com/r/web3/123",
      username: "user1",
      content: "content",
      postedAt: new Date("2024-03-21T12:00:00.000Z"),
      likes: 10,
      nComments: 5,
    };

    const input = mapPostToAiInput(post as any);
    
    expect(input.id).toBe("post1");
    expect(input.platform).toBe("reddit");
    expect(input.topic).toBe("web3");
    expect(input.url).toBe("https://reddit.com/r/web3/123");
    expect(input.username).toBe("user1");
    expect(input.content).toBe("content");
    expect(input.postedAt).toBe("2024-03-21T12:00:00.000Z");
    expect(input.likes).toBe(10);
    expect(input.nComments).toBe(5);
  });
});
