import { z } from "zod";

export const EnvSchema = z.object({
  /** Mastra server host */
  MASTRA_HOST: z.string().default("0.0.0.0"),
  /** Mastra server port */
  MASTRA_PORT: z.string().default("4111").transform((v) => {
    const port = parseInt(v, 10);
    if (isNaN(port)) {
      throw new Error(`Invalid MASTRA_PORT: ${v}`);
    }
    return port;
  }),
  /** Mastra log level (debug, info, warn, error) */
  MASTRA_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /** LibSQL storage URL for Mastra state */
  MASTRA_STORAGE_URL: z.string().default("file:./mastra.db"),
  /** File path for the observability SQLite database */
  MASTRA_OBSERVABILITY_DB_PATH: z.string().default("./mastra-observability.db"),
  /** Mastra Cloud access token (optional) */
  MASTRA_CLOUD_ACCESS_TOKEN: z.string().optional(),

  // ── Models ───────────────────────────────────────────────
  /** Model for lightweight / filtering tasks */
  GTM_SMALL_MODEL: z.string().default("ollama-cloud/gemma4:31b"),
  /** Model for analysis and reasoning tasks */
  GTM_ANALYSIS_MODEL: z.string().default("ollama-cloud/gemma4:31b"),
  /** Model for generating search terms */
  GTM_SEARCH_TERM_MODEL: z.string().default("ollama-cloud/gemma4:31b"),
  /** Model for filtering search results */
  GTM_SEARCH_FILTER_MODEL: z.string().default("ollama-cloud/gemma4:31b"),

  // ── External APIs ────────────────────────────────────────
  /** API key for the Ollama Cloud provider */
  OLLAMA_API_KEY: z.string().optional(),
  /** API key for the Deepseek provider */
  DEEPSEEK_API_KEY: z.string().optional(),
  /** API key for Serper (Google search) */
  SERPER_API_KEY: z.string(),
  /** API key for Context.dev */
  CONTEXT_DEV_API_KEY: z.string(),

  /** API token for the dOrg agents API */
  DORG_API_TOKEN: z.string().optional(),
  /** Base URL for the dOrg agents API */
  DORG_API_BASE_URL: z.string().default("https://agentsofdorg.tech/api"),

  // ── Redis ────────────────────────────────────────────────
  /** Redis connection URL */
  REDIS_URL: z.string().min(1),
  /** Redis key used for URL deduplication set */
  URLS_DEDUP_KEY: z.string().default("gtm:urls_dedup"),
});

/**
 * Validated application environment variables.
 */
export const appEnv = EnvSchema.parse(process.env);

export type AppEnv = z.infer<typeof EnvSchema>;
