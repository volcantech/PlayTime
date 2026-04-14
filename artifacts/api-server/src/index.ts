import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { setupWebSocketServer } from "./lib/wsServer";
import { seedIfEmpty } from "./lib/seed";
import { reloadCardCache } from "./lib/cardCache";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  await seedIfEmpty();
  await reloadCardCache();
  logger.info("Card cache loaded from database.");

  const server = http.createServer(app);
  setupWebSocketServer(server);

  server.listen(port, () => {
    logger.info({ port }, "Server listening");
  });

  server.on("error", (err) => {
    logger.error({ err }, "Server error");
    process.exit(1);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
