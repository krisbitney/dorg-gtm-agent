import { z } from "zod";

export const EnvSchema = z.object({
  MASTRA_HOST: z.string().default("0.0.0.0"),
  MASTRA_PORT: z.string().default("4111").transform((v) => {
    const port = parseInt(v, 10);
    if (isNaN(port)) {
      throw new Error(`Invalid MASTRA_PORT: ${v}`);
    }
    return port;
  }),
  MASTRA_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  MASTRA_STORAGE_URL: z.string().default("file:./mastra.db"),
  MASTRA_OBSERVABILITY_DB_PATH: z.string().default("./mastra-observability.db"),
  MASTRA_CLOUD_ACCESS_TOKEN: z.string().optional(),

  // ── Models ───────────────────────────────────────────────
  GTM_SMALL_MODEL: z.string().default("ollama-cloud/gemma3:4b"),
  GTM_ANALYSIS_MODEL: z.string().default("ollama-cloud/gemma4:31b"),
  GTM_SEARCH_TERM_MODEL: z.string().default("ollama-cloud/gemma4:31b"),
  GTM_SEARCH_FILTER_MODEL: z.string().default("ollama-cloud/gemma3:4b"),
  GTM_DEEP_RESEARCH_MODEL: z.string().default("ollama-cloud/gemma4:31b"),
  GTM_MESSAGE_GEN_MODEL: z.string().default("ollama-cloud/gemma4:31b"),

  // ── External APIs ────────────────────────────────────────
  OLLAMA_API_KEY: z.string().optional(),
  SERPER_API_KEY: z.string().optional(),
  CONTEXT_DEV_API_KEY: z.string().optional(),

  DORG_API_TOKEN: z.string().optional(),
  DORG_API_BASE_URL: z.string().default("https://agentsofdorg.tech/api"),

  // ── Redis ────────────────────────────────────────────────
  REDIS_URL: z.string().optional(),
  URLS_DEDUP_KEY: z.string().default("gtm:urls_dedup"),
});

export const validateEnv = (env: Record<string, string | undefined>) => EnvSchema.parse(env);

/**
 * Validated application environment variables.
 */
export const appEnv = validateEnv(process.env);

export type AppEnv = z.infer<typeof EnvSchema>;
