import { createServer } from "../http/create-server.js";

/**
 * Entry point for the GTM Workers HTTP API.
 */
async function main() {
  console.log("Starting GTM Workers API...");
  const server = createServer();
  console.log(`API server listening at http://${server.hostname}:${server.port}`);
}

main().catch((error) => {
  console.error("Failed to start API server:", error);
  process.exit(1);
});
