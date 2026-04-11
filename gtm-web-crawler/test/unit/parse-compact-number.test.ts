import { test, expect, describe } from "bun:test";
import { parseCompactNumber } from "../../src/lib/parse-utils.js";

describe("parseCompactNumber", () => {
  test("should parse plain numbers", () => {
    expect(parseCompactNumber("123")).toBe(123);
    expect(parseCompactNumber("0")).toBe(0);
    expect(parseCompactNumber(" 1500 ")).toBe(1500);
  });

  test("should parse numbers with k suffix", () => {
    expect(parseCompactNumber("1k")).toBe(1000);
    expect(parseCompactNumber("1.2k")).toBe(1200);
    expect(parseCompactNumber("1.25k")).toBe(1250);
  });

  test("should parse numbers with m suffix", () => {
    expect(parseCompactNumber("1m")).toBe(1000000);
    expect(parseCompactNumber("3.5m")).toBe(3500000);
  });

  test("should handle commas", () => {
    expect(parseCompactNumber("1,200")).toBe(1200);
    expect(parseCompactNumber("1,000,000")).toBe(1000000);
  });

  test("should handle trailing text", () => {
    expect(parseCompactNumber("123 comments")).toBe(123);
    expect(parseCompactNumber("1.2k upvotes")).toBe(1200);
  });

  test("should return null for invalid input", () => {
    expect(parseCompactNumber("")).toBeNull();
    expect(parseCompactNumber("abc")).toBeNull();
    expect(parseCompactNumber(null as any)).toBeNull();
  });
});
