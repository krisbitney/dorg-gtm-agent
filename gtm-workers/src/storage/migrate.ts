import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { appEnv } from "../config/app-env.js";

async function main() {
  console.log("Running migrations...");
  const migrationClient = postgres(appEnv.DATABASE_URL, { max: 1 });
  const db = drizzle(migrationClient);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await migrationClient.end();
  console.log("Migrations completed!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
