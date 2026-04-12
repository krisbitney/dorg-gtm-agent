import { test, expect, describe } from "bun:test";
import { validateEnv } from "../../src/mastra/config/app-env";

describe("App Environment Configuration", () => {
  test("valid env parses successfully with defaults", () => {
    const result = validateEnv({});
    expect(result.MASTRA_HOST).toBe("0.0.0.0");
    expect(result.MASTRA_PORT).toBe(4111);
    expect(result.MASTRA_LOG_LEVEL).toBe("info");
    expect(result.GTM_SMALL_MODEL).toBe("ollama-cloud/gemma3:4b");
  });

  test("can override defaults", () => {
    const result = validateEnv({
      MASTRA_PORT: "5000",
      MASTRA_LOG_LEVEL: "debug",
      GTM_SMALL_MODEL: "ollama/llama3",
    });
    expect(result.MASTRA_PORT).toBe(5000);
    expect(result.MASTRA_LOG_LEVEL).toBe("debug");
    expect(result.GTM_SMALL_MODEL).toBe("ollama/llama3");
  });

  test("invalid port value fails", () => {
    // parseInt returns NaN for nonsense strings.
    const result = validateEnv({ MASTRA_PORT: "not-a-number" });
    expect(result.MASTRA_PORT).toBeNaN();
  });

  test("invalid log level fails", () => {
    expect(() => validateEnv({ MASTRA_LOG_LEVEL: "trace" as any })).toThrow();
  });
});
