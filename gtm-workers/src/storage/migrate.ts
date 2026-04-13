import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { appEnv } from "../config/app-env.js";

/**
 * Applies all pending SQL migrations using the configured DATABASE_URL.
 */
export async function runMigrations(): Promise<void> {
  const migrationClient = postgres(appEnv.DATABASE_URL, { max: 1 });
  try {
    const db = drizzle(migrationClient);
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await migrationClient.end();
  }
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
