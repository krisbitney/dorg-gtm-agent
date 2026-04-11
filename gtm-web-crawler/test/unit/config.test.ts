import { test, expect, describe } from "bun:test";
import { configSchema } from "../../src/config/config.js";

describe("Config Validation", () => {
  const validEnv = {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    REDIS_URL: "redis://localhost:6379",
    CRAWLER_HEADLESS: "true",
    CRAWLER_MAX_REQUESTS_PER_CRAWL: "50",
    CRAWLER_MAX_CONCURRENCY: "2",
  };

  test("should parse a valid config", () => {
    const result = configSchema.parse(validEnv);
    expect(result.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(result.REDIS_URL).toBe(validEnv.REDIS_URL);
    expect(result.CRAWLER_HEADLESS).toBe(true);
    expect(result.CRAWLER_MAX_REQUESTS_PER_CRAWL).toBe(50);
    expect(result.CRAWLER_MAX_CONCURRENCY).toBe(2);
  });

  test("should use defaults for optional fields", () => {
    const result = configSchema.parse({
      DATABASE_URL: validEnv.DATABASE_URL,
      REDIS_URL: validEnv.REDIS_URL,
    });
    expect(result.CRAWLER_HEADLESS).toBe(true);
    expect(result.CRAWLER_MAX_REQUESTS_PER_CRAWL).toBe(20);
    expect(result.CRAWLER_MAX_CONCURRENCY).toBe(1);
    expect(result.CRAWLER_REQUEST_TIMEOUT_MS).toBe(60000);
    expect(result.CRAWLER_NAVIGATION_TIMEOUT_MS).toBe(30000);
    expect(result.CRAWLER_PROXY_URLS).toBeUndefined();
  });

  test("should parse proxy URLs as a list", () => {
    const result = configSchema.parse({
      ...validEnv,
      CRAWLER_PROXY_URLS: "http://proxy1:8080, http://proxy2:8081",
    });
    expect(result.CRAWLER_PROXY_URLS).toEqual([
      "http://proxy1:8080",
      "http://proxy2:8081",
    ]);
  });

  test("should fail with invalid URLs", () => {
    expect(() => configSchema.parse({
      ...validEnv,
      DATABASE_URL: "not-a-url",
    })).toThrow();
  });

  test("should fail with missing required fields", () => {
    try {
      configSchema.parse({});
    } catch (e: any) {
      expect(e.message).toContain("DATABASE_URL");
      expect(e.message).toContain("REDIS_URL");
    }
  });
});
