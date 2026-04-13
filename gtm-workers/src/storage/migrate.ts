import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { appEnv } from "../config/app-env.js";

const MIGRATION_MAX_ATTEMPTS: number = 20;
const MIGRATION_RETRY_DELAY_MS: number = 1500;
const TRANSIENT_DB_ERROR_MARKERS: readonly string[] = [
  "econnrefused",
  "could not connect to server",
  "database system is starting up",
  "the database system is starting up",
  "terminating connection due to administrator command",
  "connection terminated unexpectedly",
];

function sleep(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve: () => void) => {
    setTimeout(resolve, milliseconds);
  });
}

function extractErrorText(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const messageParts: string[] = [error.message];
  const cause: unknown = error.cause;
  if (cause instanceof Error) {
    messageParts.push(cause.message);
  }

  return messageParts.join(" | ").toLowerCase();
}

function isTransientDatabaseStartupError(error: unknown): boolean {
  const errorText: string = extractErrorText(error);
  return TRANSIENT_DB_ERROR_MARKERS.some((marker: string): boolean => errorText.includes(marker));
}

/**
 * Applies all pending SQL migrations using the configured DATABASE_URL.
 */
export async function runMigrations(): Promise<void> {
  for (let attempt: number = 1; attempt <= MIGRATION_MAX_ATTEMPTS; attempt++) {
    console.log(`Running db migrations (attempt ${attempt}/${MIGRATION_MAX_ATTEMPTS})...`);
    const migrationClient = postgres(appEnv.DATABASE_URL, { max: 1 });
    try {
      const db = drizzle(migrationClient);
      await migrate(db, { migrationsFolder: "./drizzle" });
      console.log("Migrations completed!");
      return;
    } catch (error: unknown) {
      const shouldRetry: boolean =
        isTransientDatabaseStartupError(error) && attempt < MIGRATION_MAX_ATTEMPTS;

      if (!shouldRetry) {
        throw error;
      }

      const delayMs: number = MIGRATION_RETRY_DELAY_MS * attempt;
      console.warn(
        `Migration attempt ${attempt} failed due to transient DB readiness. Retrying in ${delayMs}ms...`
      );
      await sleep(delayMs);
    } finally {
      await migrationClient.end();
    }
  }

  throw new Error("Migrations failed after all retry attempts.");
}

async function main(): Promise<void> {
  console.log("Running migrations...");
  await runMigrations();
  console.log("Migrations completed!");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
