import "./bootstrap";
import "reflect-metadata";
import "./database";
import RabbitMQService from "./services/RabbitMQService";
import FlowWorkerService from "./services/FlowServices/FlowWorkerService";
import { logger } from "./utils/logger";
import { createServer } from "http";
import fs from "fs";
import path from "path";

const startWorker = async () => {
  logger.info("Starting Flow Engine Worker...");

  try {
    // Connect to RabbitMQ
    await RabbitMQService.connect();
    
    // Start Worker Consumer
    await FlowWorkerService.start();
    
    logger.info("Flow Engine Worker is running!");

    // Lightweight HTTP server for /version
    const port = Number(process.env.FLOW_WORKER_PORT || 3336);
    const server = createServer((req, res) => {
      if (req.method === "GET" && req.url === "/version") {
        let version = "0.0.0";
        try {
          const pkgPath = path.join(process.cwd(), "package.json");
          if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
            version = pkg.version || version;
          }
        } catch {}
        const lastUpdated =
          process.env.BUILD_TIMESTAMP ||
          new Date(Number(process.env.BUILD_UNIX_TS || Date.now())).toISOString();
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.statusCode = 200;
        res.end(JSON.stringify({ service: "flow-worker", version, lastUpdated }));
        return;
      }
      res.statusCode = 404;
      res.end("Not Found");
    });
    server.listen(port, () => {});

    // Keep process alive
    process.on("SIGTERM", () => {
      logger.info("SIGTERM received. Shutting down worker...");
      process.exit(0);
    });

  } catch (err) {
    logger.error(`Fatal Error in Flow Worker: ${err}`);
    process.exit(1);
  }
};

startWorker();
