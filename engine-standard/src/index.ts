import dotenv from "dotenv";
import { RabbitMQ } from "./rabbitmq";
import { SessionManager } from "./session";
import { logger } from "./logger";
import { startHttpServer } from "./http";

dotenv.config();

const AMQP_URL = process.env.AMQP_URL || "amqp://guest:guest@localhost:5672";

const start = async () => {
  logger.info("Starting Watink Engine Standard...");

  startHttpServer();

  const rabbitmq = new RabbitMQ(AMQP_URL);
  await rabbitmq.connect();

  const sessionManager = new SessionManager(rabbitmq);

  await rabbitmq.consumeCommands(async (msg) => {
    await sessionManager.handleCommand(msg);
  });
};

start().catch((err) => {
  logger.error("Fatal error starting engine", err);
  process.exit(1);
});
