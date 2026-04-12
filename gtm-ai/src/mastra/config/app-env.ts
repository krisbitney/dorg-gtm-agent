import { z } from "zod";

export const EnvSchema = z.object({
  MASTRA_HOST: z.string().default("0.0.0.0"),
  MASTRA_PORT: z.string().default("4111").transform((v) => parseInt(v, 10)),
  MASTRA_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  MASTRA_STORAGE_URL: z.string().default("file:./mastra.db"),
  MASTRA_OBSERVABILITY_DB_PATH: z.string().default("./mastra-observability.db"),
  MASTRA_CLOUD_ACCESS_TOKEN: z.string().optional(),
  
  GTM_SMALL_MODEL: z.string().default("ollama-cloud/gemma3:4b"),
  GTM_ANALYSIS_MODEL: z.string().default("ollama-cloud/gemma4:31b"),

  OLLAMA_API_KEY: z.string().optional(),

  /**
   * Threshold for deciding if a post is likely enough to be a lead for dOrg
   * to trigger the more expensive analysis workflow and worker escalation.
   */
  LEAD_SCORE_THRESHOLD: z.coerce.number().default(0.7),
});

export const validateEnv = (env: Record<string, string | undefined>) => EnvSchema.parse(env);

/**
 * Validated application environment variables.
 */
export const appEnv = validateEnv(process.env);

export type AppEnv = z.infer<typeof EnvSchema>;
