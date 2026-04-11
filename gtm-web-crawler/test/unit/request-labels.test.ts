import { test, expect, describe } from "bun:test";
import { LABELS } from "../../src/constants/labels.js";

describe("Request Labels", () => {
  test("should have stable constants", () => {
    expect(LABELS.SUBREDDIT).toBe("SUBREDDIT");
    expect(LABELS.POST).toBe("POST");
  });

  test("should be immutable", () => {
    // @ts-expect-error - testing immutability
    expect(() => { LABELS.SUBREDDIT = "NEW"; }).toThrow();
  });
});
