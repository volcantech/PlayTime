import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { setupWebSocketServer } from "./lib/wsServer";
import { seedIfEmpty } from "./lib/seed";
import { reloadCardCache } from "./lib/cardCache";
import { reloadUndercoverWordCache } from "./lib/undercoverWordCache";
import { reloadPBCategoryCache } from "./lib/petitBacCategoryCache";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);
const host = process.env["HOST"] ?? "0.0.0.0";

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function startKeepAlive(baseUrl: string): void {
  const url = `${baseUrl}/healthz`;
  const INTERVAL_MS = 5 * 60 * 1000;

  setInterval(async () => {
    try {
      const res = await fetch(url);
      logger.info({ status: res.status }, "Keep-alive ping sent");
    } catch (err) {
      logger.warn({ err }, "Keep-alive ping failed");
    }
  }, INTERVAL_MS);

  logger.info({ url, intervalMinutes: 5 }, "Keep-alive started");
}

async function main() {
  await seedIfEmpty();
  await reloadCardCache();
  await reloadUndercoverWordCache();
  await reloadPBCategoryCache();
  logger.info("Card cache loaded from database.");

  const server = http.createServer(app);
  setupWebSocketServer(server);

  server.listen(port, host, () => {
    logger.info({ host, port }, "Server listening");

    const renderUrl = process.env["RENDER_EXTERNAL_URL"];
    if (renderUrl) {
      startKeepAlive(renderUrl);
    }
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
