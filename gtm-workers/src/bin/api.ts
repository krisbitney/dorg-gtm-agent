import { createServer } from "../http/create-server.js";
import { runMigrations } from "../storage/migrate.js";

/**
 * Entry point for the GTM Workers HTTP API.
 */
async function main(): Promise<void> {
  console.log("Starting GTM Workers API...");
  console.log("Ensuring database schema is up to date...");
  await runMigrations();
  const server = createServer();
  console.log(`API server listening at http://${server.hostname}:${server.port}`);
}

main().catch((error) => {
  console.error("Failed to start API server:", error);
  process.exit(1);
});
