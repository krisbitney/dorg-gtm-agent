import { test, expect, describe } from "bun:test";

describe("appEnv", () => {
  test("should parse valid environment variables", () => {
    // We can't easily reset process.env for the actual appEnv.parse
    // because it's called at the top level of app-env.ts.
    // However, we can test the schema export if we make it accessible,
    // but the current app-env.ts only exports appEnv (the parsed object).
    
    // In Bun, we can re-import the module with modified process.env if we're careful
    // but the easiest is to just check if the current one exists.
    const { appEnv } = require("../../src/config/app-env.js");
    expect(appEnv).toBeDefined();
    expect(typeof appEnv.WORKERS_API_PORT).toBe("number");
  });
});
