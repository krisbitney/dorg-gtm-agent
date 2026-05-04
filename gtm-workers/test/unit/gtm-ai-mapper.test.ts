import { test, expect, describe } from "bun:test";
import { mapPostToAiInput } from "../../src/clients/gtm-ai-client.js";

describe("mapPostToAiInput", () => {
  test("should map a database post to AI input", () => {
    const postData = {
      subreddit: "web3",
      username: "user1",
      content: "content",
      postedAt: "2024-03-21T12:00:00.000Z",
      likes: 10,
      nComments: 5,
    };

    const post = {
      id: "post1",
      platform: "reddit",
      url: "https://reddit.com/r/web3/123",
      post: postData,
    };

    const input = mapPostToAiInput(post as any);
    
    expect(input.id).toBe("post1");
    expect(input.platform).toBe("reddit");
    expect(input.url).toBe("https://reddit.com/r/web3/123");
    expect(input.content).toEqual(postData);
  });
});
